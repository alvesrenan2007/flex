use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

// Accept the shared state from lib.rs
pub fn init<R: Runtime>(is_active: Arc<AtomicBool>) -> TauriPlugin<R> {
    Builder::new("local-proxy")
        .setup(move |_app, _api| {
            println!("🔌 Initializing FLEX Local Proxy Plugin...");

            let active_state = is_active.clone();
            tauri::async_runtime::spawn(async move {
                run_local_proxy(8080, active_state).await;
            });

            Ok(())
        })
        .build()
}

async fn run_local_proxy(port: u16, is_active: Arc<AtomicBool>) {
    let whitelist_content =
        std::fs::read_to_string("whitelist.json").unwrap_or_else(|_| "[]".to_string());

    let domains: Vec<String> =
        serde_json::from_str(&whitelist_content).expect("Failed to parse whitelist.json");

    let whitelist: Arc<HashSet<String>> = Arc::new(domains.into_iter().collect());
    let addr = format!("127.0.0.1:{}", port);

    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind proxy port: {}", e);
            return;
        }
    };

    println!("🛡️ FLEX Local Proxy listening on {}", addr);

    loop {
        if let Ok((client_stream, _)) = listener.accept().await {
            let whitelist_ref = Arc::clone(&whitelist);
            let active_ref = Arc::clone(&is_active); // Clone for this specific connection

            tokio::spawn(async move {
                if let Err(e) = handle_client(client_stream, whitelist_ref, active_ref).await {
                    eprintln!("Connection error: {}", e);
                }
            });
        }
    }
}

async fn handle_client(
    mut client: TcpStream,
    whitelist: Arc<HashSet<String>>,
    is_active: Arc<AtomicBool>,
) -> std::io::Result<()> {
    let mut buffer = [0u8; 4096];
    let bytes_read = client.read(&mut buffer).await?;

    if bytes_read == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request.lines();

    if let Some(first_line) = lines.next() {
        let parts: Vec<&str> = first_line.split_whitespace().collect();

        if parts.len() >= 2 && parts[0] == "CONNECT" {
            let host_port = parts[1];
            let domain = host_port.split(':').next().unwrap_or("");

            // Check the UI toggle state
            let proxy_enabled = is_active.load(Ordering::Relaxed);

            // If proxy is OFF, or if the domain is in the whitelist, allow it
            if !proxy_enabled || whitelist.contains(domain) {
                if !proxy_enabled {
                    println!("⚠️ PROXY OFF - PASSTHROUGH: {}", domain);
                } else {
                    println!("✅ ALLOWED: {}", domain);
                }

                let mut server = TcpStream::connect(host_port).await?;
                client
                    .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    .await?;
                tokio::io::copy_bidirectional(&mut client, &mut server).await?;
            } else {
                println!("🚫 BLOCKED: {}", domain);
                client.write_all(b"HTTP/1.1 403 Forbidden\r\n\r\n").await?;
            }
        }
    }

    Ok(())
}
