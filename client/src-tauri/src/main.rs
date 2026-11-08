// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod proxy;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // This is where you will initialize your background tasks
            // like the local loopback proxy or WebSocket listener later!
            let handle = app.handle();
            println!("FLEX Student Client initialized!");

            tauri::async_runtime::spawn(async move {
                proxy::run_local_proxy(8080).await;
            });

            Ok(())
        })
        .run(tauri::generate_context())
        .expect("error while running tauri application");
}
