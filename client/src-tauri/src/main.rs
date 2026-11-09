#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // This calls the run() function we defined in lib.rs
    // The name comes from the [lib] section of your Cargo.toml
    flex_client_lib::run();
}
