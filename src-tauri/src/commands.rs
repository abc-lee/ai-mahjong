//! Tauri 命令模块
//! 
//! 提供给前端调用的命令

use tauri::{AppHandle, Runtime};
use crate::sidecar;
use crate::tray;

/// 打开浏览器
#[tauri::command]
pub fn open_browser() -> Result<String, String> {
    let port = tray::get_current_port();
    let url = format!("http://localhost:{}", port);
    
    open::that(&url)
        .map(|_| url)
        .map_err(|e| format!("Failed to open browser: {}", e))
}

/// 获取当前端口
#[tauri::command]
pub fn get_port() -> u16 {
    tray::get_current_port()
}

/// 设置端口
#[tauri::command]
pub fn set_port(port: u16) {
    tray::set_current_port(port);
}

/// 获取可用端口列表
#[tauri::command]
pub fn get_available_ports() -> Vec<PortInfo> {
    // 返回常用端口列表
    vec![
        PortInfo { port: 3000, name: "localhost:3000".to_string(), available: is_port_available(3000) },
        PortInfo { port: 3001, name: "localhost:3001".to_string(), available: is_port_available(3001) },
        PortInfo { port: 8080, name: "localhost:8080".to_string(), available: is_port_available(8080) },
        PortInfo { port: 8000, name: "localhost:8000".to_string(), available: is_port_available(8000) },
        PortInfo { port: 5000, name: "localhost:5000".to_string(), available: is_port_available(5000) },
    ]
}

/// 重启服务器
#[tauri::command]
pub fn restart_server<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    sidecar::restart_server(&app)
        .map_err(|e| format!("Failed to restart server: {}", e))
}

/// 端口信息
#[derive(serde::Serialize)]
pub struct PortInfo {
    pub port: u16,
    pub name: String,
    pub available: bool,
}

/// 检查端口是否可用
fn is_port_available(port: u16) -> bool {
    use std::net::TcpListener;
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}
