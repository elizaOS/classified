// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

// Store the server process so we can kill it when the app closes
static SERVER_PROCESS: once_cell::sync::Lazy<Arc<Mutex<Option<Child>>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Check if the server is running by attempting to connect to the port
fn is_server_running() -> bool {
    match TcpStream::connect("127.0.0.1:7777") {
        Ok(_) => true,
        Err(_) => false,
    }
}

// Shutdown server when app exits
fn shutdown_server() {
    println!("Shutting down Eliza server...");
    let mut guard = SERVER_PROCESS.lock().unwrap();
    if let Some(ref mut child) = *guard {
        if let Err(e) = child.kill() {
            eprintln!("Failed to kill Eliza server: {}", e);
        } else {
            println!("Eliza server shut down successfully");
        }
    }
    *guard = None;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Register cleanup for when app exits
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Start the server if it's not already running
            if !is_server_running() {
                println!("Starting Eliza server...");
                
                // Get the resource path for the bundled server
                let resource_path = app.path().resource_dir()
                    .expect("Failed to get resource directory");
                
                let server_path = resource_path.join("dist-backend").join("server.js");
                
                println!("Server path: {:?}", server_path);
                
                match Command::new("node")
                    .arg(server_path)
                    .spawn() {
                        Ok(child) => {
                            // Store the process so we can kill it when the app closes
                            let mut server_guard = SERVER_PROCESS.lock().unwrap();
                            *server_guard = Some(child);
                            println!("Eliza server process started");
                            
                            // Wait a bit for the server to start
                            thread::sleep(Duration::from_secs(3));
                        },
                        Err(e) => {
                            eprintln!("Failed to start Eliza server: {}", e);
                            eprintln!("Make sure Node.js is installed and the server is built");
                        }
                    };
            } else {
                println!("Eliza server is already running");
            }
            
            // Add event listener for app exit
            let app_handle = app.handle();
            
            #[cfg(desktop)]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { .. } = event {
                            shutdown_server();
                        }
                    });
                }
            }
            
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
        
    app.run(|_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            shutdown_server();
        }
    });
}
