use rust_socketio::asynchronous::Client as SocketClient;
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
    pub socket_client: Mutex<Option<SocketClient>>, 
}

#[tauri::command]
fn set_connection_details(nickname: String, room_id: String, state: State<'_, AppState>) -> String {
    *state.nickname.lock().unwrap() = nickname.clone();
    *state.room_id.lock().unwrap() = room_id.clone();
    
    println!("⚙️ UI Command: Saved details - User '{}' connecting to room '{}'", nickname, room_id);
    format!("Connected as {} to {}", nickname, room_id)
}

#[tauri::command]
async fn toggle_proxy(active: bool, state: State<'_, AppState>) -> Result<String, String> {
    state.proxy_active.store(active, Ordering::Relaxed);
    
    if active {
        let room_id = state.room_id.lock().unwrap().clone();
        let nickname = state.nickname.lock().unwrap().clone();
        let wl_clone = Arc::clone(&state.whitelist);
        
        if !room_id.is_empty() && !nickname.is_empty() {
            // 1. Establish connection FIRST while the network is normal
            match proxy::connect_socketio(wl_clone, room_id, nickname).await {
                Ok(client) => {
                    *state.socket_client.lock().unwrap() = Some(client);
                }
                Err(e) => eprintln!("Socket.IO error: {}", e),
            }
        }
        
        // 2. Lock down the OS network routing SECOND
        proxy::apply_system_proxy(active, 8080);
    } else {
        // 1. Release the OS network routing FIRST
        proxy::apply_system_proxy(active, 8080);
        
        // 2. Disconnect Socket.IO SECOND
        let client_opt = state.socket_client.lock().unwrap().take();
        if let Some(client) = client_opt {
            if let Err(e) = client.disconnect().await {
                eprintln!("Error disconnecting: {}", e);
            }
            println!("🔌 Socket.IO disconnected from control plane.");
        }
    }
    
    Ok(format!("Proxy is now {}", if active { "ON" } else { "OFF" }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Instruct the app's internal HTTP clients to ignore the OS proxy
    std::env::set_var("NO_PROXY", "localhost,127.0.0.1,::1");
    
    let proxy_active = Arc::new(AtomicBool::new(false));
    let whitelist = Arc::new(RwLock::new(HashSet::new()));

    let app_state = AppState {
        proxy_active: proxy_active.clone(),
        whitelist: whitelist.clone(),
        room_id: Mutex::new(String::new()),
        nickname: Mutex::new(String::new()),
        socket_client: Mutex::new(None), // Initialize as empty
    };

    let app = tauri::Builder::default()
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
