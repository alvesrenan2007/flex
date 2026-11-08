use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

mod proxy;

pub struct AppState {
    pub proxy_active: Arc<AtomicBool>,
}

#[tauri::command]
fn toggle_proxy(active: bool, state: State<'_, AppState>) -> String {
    state.proxy_active.store(active, Ordering::Relaxed);
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
    // 1. Create the shared atomic boolean (defaults to OFF/false)
    let proxy_active = Arc::new(AtomicBool::new(false));

    // 2. Clone the Arc for the UI state
    let app_state = AppState {
        proxy_active: proxy_active.clone(),
    };

    tauri::Builder::default()
        // 3. Pass the original Arc into the proxy plugin
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
