use std::collections::HashSet;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub async fn run_local_proxy(port: u16) {
    // Load local JSON whitelist
    let whitelist_content = std::fs::read_to_string("whitelist.json")
        .unwrap_or_else(|_| "[]".to_string());
    
    let domains: Vec<String> = serde_json::from_str(&whitelist_content)
        .expect("Failed to parse whitelist.json");
    
    let whitelist: Arc<HashSet<String>> = Arc::new(domains.into_iter().collect());

    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind proxy port");
    
    println!("🛡️ FLEX Local Proxy listening on {}", addr);

    loop {
        if let Ok((client_stream, _)) = listener.accept().await {
            let whitelist_ref = Arc::clone(&whitelist);
            
            // Spawn an async task for each connection
            tokio::spawn(async move {
                if let Err(e) = handle_client(client_stream, whitelist_ref).await {
                    eprintln!("Connection error: {}", e);
                }
            });
        }
    }
}

async fn handle_client(mut client: TcpStream, whitelist: Arc<HashSet<String>>) -> std::io::Result<()> {
    let mut buffer = [0u8; 4096];
    let bytes_read = client.read(&mut buffer).await?;
    
    if bytes_read == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request.lines();
    
    if let Some(first_line) = lines.next() {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        
        // Browsers use CONNECT for HTTPS tunneling
        if parts.len() >= 2 && parts[0] == "CONNECT" {
            let host_port = parts[1];
            let domain = host_port.split(':').next().unwrap_or("");

            if whitelist.contains(domain) {
                println!("✅ ALLOWED: {}", domain);
                
                // Establish connection to the actual destination
                let mut server = TcpStream::connect(host_port).await?;
                
                // Tell the browser the tunnel is established
                client.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").await?;
                
                // Splice the streams together
                tokio::io::copy_bidirectional(&mut client, &mut server).await?;
            } else {
                println!("🚫 BLOCKED: {}", domain);
                // Return a 403 to the browser
                client.write_all(b"HTTP/1.1 403 Forbidden\r\n\r\n").await?;
            }
        }
    }
    
    Ok(())
}
