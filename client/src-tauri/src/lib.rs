use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

mod proxy;

// A thread-safe state to share between the UI and the Proxy
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
    // Initialize our shared state as OFF by default
    let app_state = AppState {
        proxy_active: Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .plugin(proxy::init())
        .manage(app_state) // Register the state
        .invoke_handler(tauri::generate_handler![
            toggle_proxy,
            set_connection_details
        ]) // Register the IPC commands
        .setup(|_app| {
            println!("FLEX Student Client UI initialized!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
