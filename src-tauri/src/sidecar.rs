//! Sidecar 后端管理模块
//! 
//! 负责启动、停止和重启 Node.js 后端服务

use tauri::{AppHandle, Manager, Runtime};
use std::process::{Command, Child};
use std::sync::Mutex;
use std::env;

// 后端进程句柄
lazy_static::lazy_static! {
    static ref SERVER_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

/// 启动后端服务
pub fn start_server<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let port = crate::tray::get_current_port();
    
    // 获取 sidecar 路径
    let sidecar_path = get_sidecar_path();
    
    // 获取应用目录（配置文件存放位置）
    let app_dir = get_app_dir();
    
    println!("Starting server on port {}...", port);
    println!("Sidecar path: {:?}", sidecar_path);
    println!("App directory: {:?}", app_dir);
    
    // 启动进程
    let child = Command::new(&sidecar_path)
        .env("PORT", port.to_string())
        .env("TAURI_SIDECAR", "1")
        .env("AI_MAHJONG_CONFIG_DIR", &app_dir)
        .spawn()
        .expect("Failed to start server");
    
    // 保存进程句柄
    *SERVER_PROCESS.lock().unwrap() = Some(child);
    
    println!("Server started on port {}", port);
    
    Ok(())
}

/// 停止后端服务
pub fn stop_server() {
    if let Ok(mut process) = SERVER_PROCESS.lock() {
        if let Some(mut child) = process.take() {
            let _ = child.kill();
            println!("Server stopped");
        }
    }
}

/// 重启后端服务
pub fn restart_server<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    stop_server();
    std::thread::sleep(std::time::Duration::from_millis(500));
    start_server(app)
}

/// 获取 Sidecar 可执行文件路径
fn get_sidecar_path() -> std::path::PathBuf {
    let exe_dir = env::current_exe().unwrap().parent().unwrap().to_path_buf();
    
    #[cfg(target_os = "windows")]
    let binary_name = "ai-mahjong-server-x86_64-pc-windows-msvc.exe";
    
    #[cfg(target_os = "macos")]
    let binary_name = "ai-mahjong-server-aarch64-apple-darwin";
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let binary_name = "ai-mahjong-server-x86_64-unknown-linux-gnu";
    
    exe_dir.join("binaries").join(binary_name)
}

/// 获取应用配置目录
fn get_app_dir() -> String {
    let exe_dir = env::current_exe().unwrap().parent().unwrap().to_path_buf();
    
    // 配置目录在可执行文件同级
    let config_dir = exe_dir.join("config");
    
    // 确保目录存在
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).unwrap();
    }
    
    config_dir.to_string_lossy().to_string()
}
