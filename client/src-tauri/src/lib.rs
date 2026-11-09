use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{RunEvent, State}; // <-- Add RunEvent here

mod proxy;

pub struct AppState {
    pub proxy_active: Arc<AtomicBool>,
}

#[tauri::command]
fn toggle_proxy(active: bool, state: State<'_, AppState>) -> String {
    state.proxy_active.store(active, Ordering::Relaxed);

    // 1. Tell the OS to route traffic through our port
    proxy::apply_system_proxy(active, 8080);

    println!("⚙️ UI Command: Proxy state changed to {}", active);
    format!("Proxy is now {}", if active { "ON" } else { "OFF" })
}

#[tauri::command]
fn set_connection_details(nickname: String, room_id: String) -> String {
    println!(
        "⚙️ UI Command: User '{}' connecting to room '{}'",
        nickname, room_id
    );
    format!("Connected as {} to {}", nickname, room_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let proxy_active = Arc::new(AtomicBool::new(false));

    let app_state = AppState {
        proxy_active: proxy_active.clone(),
    };

    // 2. Separate build() and run() to catch application events
    let app = tauri::Builder::default()
        .plugin(proxy::init(proxy_active))
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            toggle_proxy,
            set_connection_details
        ])
        .setup(|_app| {
            println!("FLEX Student Client UI initialized!");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // 3. Catch the Exit event to prevent leaving the student without internet
    app.run(|_app_handle, event| match event {
        RunEvent::Exit => {
            println!("🧹 Application closing: Cleaning up OS proxy settings...");
            proxy::apply_system_proxy(false, 8080);
        }
        _ => {}
    });
}
