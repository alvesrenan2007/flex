use rust_socketio::Payload;
use rust_socketio::asynchronous::{Client, ClientBuilder};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use sysproxy::Sysproxy;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use url::Url;

#[derive(Deserialize, Debug)]
struct RoomJoinResponse {
    ok: bool,
    room: Option<RoomData>,
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RoomData {
    whitelist: Vec<String>,
}

pub fn init<R: Runtime>(
    is_active: Arc<AtomicBool>, 
    whitelist: Arc<RwLock<HashSet<String>>>
) -> TauriPlugin<R> {
    Builder::new("local-proxy")
        .setup(move |_app, _api| {
            println!("🔌 Initializing FLEX Local Proxy Plugin...");

            let active_state = is_active.clone();
            let wl_state = whitelist.clone();
            
            tauri::async_runtime::spawn(async move {
                // Pass the shared whitelist into the proxy loop
                run_local_proxy(8080, active_state, wl_state).await;
            });

            Ok(())
        })
        .build()
}

async fn run_local_proxy(
    port: u16, 
    is_active: Arc<AtomicBool>, 
    whitelist: Arc<RwLock<HashSet<String>>>
) {
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
            let active_ref = Arc::clone(&is_active);

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
    whitelist: Arc<RwLock<HashSet<String>>>,
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

            let proxy_enabled = is_active.load(Ordering::Relaxed);

            let is_allowed = {
                let wl = whitelist.read().await;
                
                // 🐛 DEBUG: Print the requested domain and the current whitelist
                println!("🔍 DEBUG: Intercepted '{}' | Current Whitelist: {:?}", domain, *wl);
                
                // Allow if exact match OR if the domain ends with ".whitelisted.com"
                wl.contains(domain) || wl.iter().any(|allowed| {
                    domain.ends_with(&format!(".{}", allowed))
                })
            };

            if !proxy_enabled || is_allowed {
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

pub async fn run_socketio_client(
    whitelist: Arc<RwLock<HashSet<String>>>,
    room_id: String,
    nickname: String,
) {
    let url = "http://purge-uncolored-movie.ngrok-free.dev";
    println!("📡 Connecting to FLEX Control Plane at {}", url);

    let client = ClientBuilder::new(url)
        .connect()
        .await
        .expect("❌ Failed to connect to Socket.IO server");

    println!("✅ Connected via Socket.IO!");

    let payload = json!({
        "roomId": room_id,
        "nickname": nickname
    });

    let wl_clone = Arc::clone(&whitelist);

    // 1. Explicitly declare the required Future type to enforce coercion
    let ack_callback = move |payload: Payload, _client: Client| -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'static>> {
        let wl_inner = Arc::clone(&wl_clone);
        
        Box::pin(async move {
            if let Payload::Text(values) = payload {
                if let Some(parsed_value) = values.first() {
                    
                    // 1. Unwrap the Socket.IO array layer
                    let target_value = if parsed_value.is_array() {
                        parsed_value[0].clone()
                    } else {
                        parsed_value.clone()
                    };

                    // 2. Parse the extracted object
                    match serde_json::from_value::<RoomJoinResponse>(target_value) {
                        Ok(response) => {
                            if response.ok {
                                if let Some(room) = response.room {
                                    let mut wl = wl_inner.write().await;
                                    wl.clear();

                                    for raw_url in room.whitelist {
                                        let parseable_url = if raw_url.starts_with("http://") || raw_url.starts_with("https://") {
                                            raw_url.clone()
                                        } else {
                                            format!("https://{}", raw_url)
                                        };

                                        if let Ok(parsed_url) = Url::parse(&parseable_url) {
                                            if let Some(host) = parsed_url.host_str() {
                                                wl.insert(host.to_string());
                                            }
                                        } else {
                                            wl.insert(raw_url.clone());
                                        }
                                    }
                                    println!("✅ Whitelist sync complete. Active domains: {:?}", *wl);
                                }
                            } else {
                                eprintln!("❌ Server denied entry: {:?}", response.error);
                            }
                        }
                        Err(e) => {
                            eprintln!("❌ JSON PARSE ERROR: {}", e);
                        }
                    }
                }
            }
        })
    };

    if let Err(e) = client
        .emit_with_ack("room:join", payload, std::time::Duration::from_secs(5), ack_callback)
        .await
    {
        eprintln!("❌ Acknowledgment error: {}", e);
    }
}

pub fn apply_system_proxy(enable: bool, port: u16) {
    let proxy = Sysproxy {
        enable,
        host: "127.0.0.1".into(),
        port,
        bypass: "localhost,127.0.0.1".into(),
    };

    match proxy.set_system_proxy() {
        Ok(_) => println!(
            "🌐 OS Network Routing set to: {}",
            if enable { "ON" } else { "OFF" }
        ),
        Err(e) => eprintln!("❌ Failed to change OS proxy settings: {}", e),
    }
}
