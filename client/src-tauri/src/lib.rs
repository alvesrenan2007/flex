use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{RunEvent, State};
use tokio::sync::RwLock;

mod proxy;

pub struct AppState {
    pub proxy_active: Arc<AtomicBool>,
    pub whitelist: Arc<RwLock<HashSet<String>>>,
    pub room_id: Mutex<String>,
    pub nickname: Mutex<String>,
}

#[tauri::command]
fn set_connection_details(nickname: String, room_id: String, state: State<'_, AppState>) -> String {
    // Save the UI inputs into our Rust state
    *state.nickname.lock().unwrap() = nickname.clone();
    *state.room_id.lock().unwrap() = room_id.clone();
    
    println!("⚙️ UI Command: Saved details - User '{}' connecting to room '{}'", nickname, room_id);
    format!("Connected as {} to {}", nickname, room_id)
}

#[tauri::command]
fn toggle_proxy(active: bool, state: State<'_, AppState>) -> String {
    state.proxy_active.store(active, Ordering::Relaxed);
    
    // Apply the OS network routing
    proxy::apply_system_proxy(active, 8080);
    
    // If the proxy is turned ON, trigger the Socket.IO connection
    if active {
        let room_id = state.room_id.lock().unwrap().clone();
        let nickname = state.nickname.lock().unwrap().clone();
        let wl_clone = Arc::clone(&state.whitelist);
        
        if !room_id.is_empty() && !nickname.is_empty() {
            tauri::async_runtime::spawn(async move {
                proxy::run_socketio_client(wl_clone, room_id, nickname).await;
            });
        } else {
            println!("⚠️ Skipping Socket.IO: Room ID or Nickname is missing.");
        }
    }
    
    println!("⚙️ UI Command: Proxy state changed to {}", active);
    format!("Proxy is now {}", if active { "ON" } else { "OFF" })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let proxy_active = Arc::new(AtomicBool::new(false));
    let whitelist = Arc::new(RwLock::new(HashSet::new()));

    let app_state = AppState {
        proxy_active: proxy_active.clone(),
        whitelist: whitelist.clone(),
        room_id: Mutex::new(String::new()),
        nickname: Mutex::new(String::new()),
    };

    let app = tauri::Builder::default()
        // Pass BOTH the active boolean and the whitelist to the proxy plugin
        .plugin(proxy::init(proxy_active, whitelist)) 
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            toggle_proxy,
            set_connection_details
        ])
        .setup(|_app| {
            println!("FLEX Student Client UI initialized!");
            proxy::apply_system_proxy(false, 8080);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        RunEvent::Exit => {
            println!("🧹 Application closing: Cleaning up OS proxy settings...");
            proxy::apply_system_proxy(false, 8080);
        }
        _ => {}
    });
}
