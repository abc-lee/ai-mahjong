//! AI Mahjong Party - 桌面应用主入口
//! 
//! 功能：
//! - 系统托盘图标
//! - 右键菜单（打开浏览器、设置、退出）
//! - Sidecar 后端管理
//! - 单实例模式

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tray;
mod sidecar;
mod commands;

use tauri::Manager;
use tauri_plugin_single_instance::SingleInstance;

fn main() {
    tauri::Builder::default()
        // 单实例插件
        .plugin(SingleInstance::new(|app, _args, _cwd| {
            // 如果已有实例运行，显示窗口
            if let Some(window) = app.get_webview_window("main") {
                window.show().unwrap();
                window.set_focus().unwrap();
            }
        }))
        // Shell 插件（打开浏览器等）
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 创建系统托盘
            tray::create_tray(app.handle())?;
            
            // 启动后端服务
            sidecar::start_server(app.handle())?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_browser,
            commands::get_port,
            commands::set_port,
            commands::get_available_ports,
            commands::restart_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
