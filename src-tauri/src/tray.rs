//! 系统托盘模块

use tauri::{
    AppHandle, Manager,
    tray::{TrayIcon, TrayIconBuilder},
    menu::{Menu, MenuItem},
    image::Image,
    Runtime,
};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;

// 当前端口
static CURRENT_PORT: AtomicU16 = AtomicU16::new(3000);

/// 创建系统托盘图标和菜单
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    // 创建菜单项
    let open_browser = MenuItem::with_id(app, "open_browser", "打开游戏", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    
    // 创建菜单
    let menu = Menu::with_items(app, &[&open_browser, &settings, &quit])?;
    
    // 创建托盘图标
    // 注意：需要提供图标文件，这里先用占位符
    let tray = TrayIconBuilder::new()
        .tooltip("AI Mahjong Party")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_browser" => {
                // 打开浏览器
                let port = CURRENT_PORT.load(Ordering::Relaxed);
                let url = format!("http://localhost:{}", port);
                if let Err(e) = open::that(&url) {
                    eprintln!("Failed to open browser: {}", e);
                }
            }
            "settings" => {
                // 显示设置窗口
                if let Some(window) = app.get_webview_window("settings") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                } else {
                    // 创建设置窗口
                    create_settings_window(app);
                }
            }
            "quit" => {
                // 退出应用
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    
    Ok(tray)
}

/// 创建设置窗口
fn create_settings_window<R: Runtime>(app: &AppHandle<R>) {
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;
    
    let _window = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("settings.html".into())
    )
    .title("设置 - AI Mahjong Party")
    .inner_size(400.0, 300.0)
    .resizable(false)
    .build()
    .expect("Failed to create settings window");
}

/// 获取当前端口
pub fn get_current_port() -> u16 {
    CURRENT_PORT.load(Ordering::Relaxed)
}

/// 设置当前端口
pub fn set_current_port(port: u16) {
    CURRENT_PORT.store(port, Ordering::Relaxed);
}
