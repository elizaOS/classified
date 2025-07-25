// ElizaOS Game - Rust Backend Implementation
// This replaces the Node.js backend with a high-performance Rust backend

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{Manager, State};
use tracing::{info, error, warn};

// New Rust backend modules
mod backend;
mod container;
mod server;
mod ipc;
// mod agent; // Deprecated - functionality moved to ContainerManager
mod startup;
mod websocket_manager;
mod socketio_manager;

// Export types for external use (tests, etc.)
pub use backend::{AgentConfig, BackendConfig, BackendError, BackendResult, ContainerRuntimeType, ContainerStatus, ContainerState, HealthStatus, PortMapping, VolumeMount, SetupProgress, ContainerConfig};
pub use container::{ContainerManager, RuntimeDetectionStatus, HealthMonitor};
pub use server::{HttpServer, WebSocketHub};
pub use ipc::commands::*;
// pub use agent::{AgentManager, AgentStatus}; // Deprecated - use ContainerManager instead
pub use startup::{StartupManager, StartupStatus, StartupStage, UserConfig, AiProvider};
pub use websocket_manager::{WebSocketManager, WsMessage};
pub use socketio_manager::{SocketIOManager, SocketIOMessage};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from the Rust backend!", name)
}

// Tauri callback server for receiving real-time updates from backend
use axum::{extract::Json, response::Json as JsonResponse, routing::post, Router};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AgentResponseCallback {
    message_id: String,
    agent_id: String,
    room_id: String,
    content: String,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CallbackResponse {
    success: bool,
    message: String,
}

async fn handle_agent_response_callback(
    Json(payload): Json<AgentResponseCallback>
) -> JsonResponse<CallbackResponse> {
    info!("🔔 Received agent response callback: {}", payload.content);
    
    // For now, we'll emit a Tauri event that the frontend can listen to
    // Note: We need to get the app handle to emit events, but this is called from axum
    // We'll log the callback for now and implement proper event emission later
    info!("📨 Agent Response - ID: {}, Content: '{}'", payload.message_id, payload.content);
    
    // TODO: Store this callback data so it can be retrieved by the frontend
    // For now, just acknowledge receipt
    
    JsonResponse(CallbackResponse {
        success: true,
        message: "Agent response received and logged".to_string(),
    })
}

// Start the callback server on a specific port
async fn start_callback_server_on_port(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/agent-response", post(handle_agent_response_callback));

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("🔗 Tauri callback server listening on http://{}", addr);
    
    axum::serve(listener, app).await?;
    Ok(())
}

// Legacy function removed - use start_callback_server_on_port directly

async fn route_message_to_agent(message: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    
    // Use the synchronous messaging endpoint to send a message and wait for response
    let message_url = "http://localhost:7777/api/messaging/ingest-external";
    let channel_id = "e292bdf2-0baa-4677-a3a6-9426672ce6d8"; // Default channel for game UI
    let author_id = "00000000-0000-0000-0000-000000000001"; // Proper UUID format for game user
    
    let response = client
        .post(message_url)
        .json(&serde_json::json!({
            "channelId": channel_id,
            "serverId": "00000000-0000-0000-0000-000000000000", // Default server ID
            "authorId": author_id,
            "content": message,
            "sourceType": "game_ui",
            "rawMessage": {
                "text": message,
                "type": "user_message"
            },
            "metadata": {
                "source": "eliza_game",
                "userName": "Admin"
            }
        }))
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await?;

    if response.status().is_success() {
        // For the ingest-external endpoint, we get an acknowledgment but not the actual response
        // The actual response would come through WebSocket or we'd need to poll for it
        let _response_data: serde_json::Value = response.json().await?;
        
        // For now, return a confirmation that the message was ingested
        Ok(format!("Message sent to agent: {}", message))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Agent responded with status: {} - {}", status, error_text).into())
    }
}

#[tauri::command]
async fn get_container_runtime_status(
    runtime_status: State<'_, Arc<std::sync::Mutex<RuntimeDetectionStatus>>>
) -> Result<RuntimeDetectionStatus, String> {
    let status = runtime_status.lock().map_err(|e| format!("Failed to lock runtime status: {}", e))?;
    Ok(status.clone())
}

#[tauri::command]
async fn get_startup_status(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>
) -> Result<StartupStatus, String> {
    let manager = startup_manager.lock().await;
    Ok(manager.get_current_status())
}

#[tauri::command]
async fn submit_user_config(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    config: UserConfig
) -> Result<(), String> {
    info!("📝 Received user configuration from frontend");
    
    let mut manager = startup_manager.lock().await;
    manager.handle_user_config(config).await.map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn send_message_to_agent(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    message: String
) -> Result<String, String> {
    info!("💬 Received message from frontend: {}", message);
    
    let manager = startup_manager.lock().await;
    if !manager.is_ready() {
        return Err("System is not ready for messages yet".to_string());
    }
    
    // Release the lock before the sleep
    drop(manager);

    // Route message to ElizaOS Agent container via HTTP API
    match route_message_to_agent(&message).await {
        Ok(response) => Ok(response),
        Err(e) => {
            error!("Failed to route message to agent: {}", e);
            // Fallback to echo for now if agent is not available
            Ok(format!("Echo from Rust backend: {} (Agent unavailable: {})", message, e))
        }
    }
}

#[tauri::command]
async fn start_game_environment(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
) -> Result<String, String> {
    info!("🎮 Starting game environment");
    
    let manager = startup_manager.lock().await;
    let status = manager.get_current_status();
    
    match status.stage {
        crate::startup::StartupStage::Ready => Ok("Game environment already ready".to_string()),
        crate::startup::StartupStage::Error => Err("Game environment is in error state".to_string()),
        _ => Ok("Game environment is starting...".to_string()),
    }
}

#[tauri::command] 
async fn wait_for_server(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    max_attempts: u32,
    delay_ms: u64,
) -> Result<bool, String> {
    info!("⏳ Waiting for server to be ready (max {} attempts, {}ms delay)", max_attempts, delay_ms);
    
    for attempt in 0..max_attempts {
        let manager = startup_manager.lock().await;
        if manager.is_ready() {
            info!("✅ Server is ready after {} attempts", attempt + 1);
            return Ok(true);
        }
        drop(manager);
        
        if attempt < max_attempts - 1 {
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }
    
    warn!("❌ Server not ready after {} attempts", max_attempts);
    Ok(false)
}

#[tauri::command]
async fn get_agent_configuration() -> Result<serde_json::Value, String> {
    info!("📊 Getting agent configuration from ElizaOS server");
    
    let client = reqwest::Client::new();
    let url = "http://localhost:7777/api/agents";
    
    let response = client
        .get(url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch agent configuration: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Server returned error: {}", response.status()));
    }
    
    let config: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse configuration response: {}", e))?;
    
    Ok(config)
}

#[tauri::command]
async fn update_agent_configuration(config_updates: serde_json::Value) -> Result<serde_json::Value, String> {
    info!("🔄 Agent configuration update requested (feature not yet implemented in server)");
    
    // For now, return a success response since the update endpoint doesn't exist yet
    // In a real implementation, this would update the agent's configuration
    Ok(serde_json::json!({
        "success": true,
        "message": "Configuration update request received",
        "data": config_updates
    }))
}

#[tauri::command]
async fn get_available_providers() -> Result<serde_json::Value, String> {
    info!("🔍 Getting available AI providers (mock data - endpoint not yet implemented)");
    
    // For now, return mock provider data since the endpoint doesn't exist yet
    // In a real implementation, this would fetch from the agent server
    Ok(serde_json::json!({
        "success": true,
        "data": {
            "providers": [
                {
                    "name": "openai",
                    "display_name": "OpenAI",
                    "enabled": true,
                    "requires_api_key": true
                },
                {
                    "name": "anthropic", 
                    "display_name": "Anthropic",
                    "enabled": true,
                    "requires_api_key": true
                },
                {
                    "name": "ollama",
                    "display_name": "Ollama (Local)",
                    "enabled": true,
                    "requires_api_key": false
                }
            ]
        }
    }))
}

// Socket.IO Commands
#[tauri::command]
async fn connect_socketio(
    socketio_manager: tauri::State<'_, Arc<Mutex<SocketIOManager>>>,
    url: String
) -> Result<(), String> {
    info!("🔌 Connecting to Socket.IO server: {}", url);
    
    let mut manager = socketio_manager.lock().await;
    manager.connect(&url).await.map_err(|e| {
        error!("Failed to connect to Socket.IO: {}", e);
        format!("Failed to connect: {}", e)
    })
}

#[tauri::command]
async fn disconnect_socketio(
    socketio_manager: tauri::State<'_, Arc<Mutex<SocketIOManager>>>
) -> Result<(), String> {
    info!("🔌 Disconnecting from Socket.IO server");
    
    let mut manager = socketio_manager.lock().await;
    manager.disconnect().await;
    Ok(())
}

#[tauri::command]
async fn socketio_join_room(
    socketio_manager: tauri::State<'_, Arc<Mutex<SocketIOManager>>>,
    room_id: String
) -> Result<(), String> {
    info!("📍 Joining Socket.IO room: {}", room_id);
    
    let mut manager = socketio_manager.lock().await;
    manager.join_room(room_id).await.map_err(|e| {
        error!("Failed to join room: {}", e);
        format!("Failed to join room: {}", e)
    })
}

#[tauri::command]
async fn send_socketio_message(
    socketio_manager: tauri::State<'_, Arc<Mutex<SocketIOManager>>>,
    message: String,
    room_id: String
) -> Result<(), String> {
    info!("📤 Sending Socket.IO message to room {}: {}", room_id, message);
    
    let manager = socketio_manager.lock().await;
    manager.send_message(&message, &room_id).await.map_err(|e| {
        error!("Failed to send message: {}", e);
        format!("Failed to send message: {}", e)
    })
}

#[tauri::command]
async fn is_socketio_connected(
    socketio_manager: tauri::State<'_, Arc<Mutex<SocketIOManager>>>
) -> Result<bool, String> {
    let manager = socketio_manager.lock().await;
    Ok(manager.is_connected())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting ElizaOS Game with Rust backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_container_runtime_status,
            get_startup_status,
            submit_user_config,
            send_message_to_agent,
            start_game_environment,
            wait_for_server,
            // Configuration management commands
            get_agent_configuration,
            update_agent_configuration,
            get_available_providers,
            // Container management commands
            get_container_status_new,
            start_postgres_container,
            start_ollama_container,
            start_agent_container,
            restart_container_new,
            stop_container_new,
            stop_all_containers_new,
            setup_complete_environment_new,
            get_setup_progress_new,
            // Agent capability management commands
            toggle_autonomy,
            get_autonomy_status,
            toggle_capability,
            get_capability_status,
            update_agent_setting,
            get_agent_settings,
            get_vision_settings,
            refresh_vision_service,
            // Data fetching commands
            fetch_goals,
            fetch_todos,
            fetch_knowledge_files,
            delete_knowledge_file,
            fetch_plugin_configs,
            update_plugin_config,
            validate_configuration,
            test_configuration,
            reset_agent,
            fetch_autonomy_status,
            fetch_memories,
            // Health check
            health_check,
            // WebSocket commands (legacy)
            connect_websocket,
            disconnect_websocket,
            websocket_join_channel,
            is_websocket_connected,
            // Socket.IO commands
            connect_socketio,
            disconnect_socketio,
            socketio_join_room,
            send_socketio_message,
            is_socketio_connected
        ])
        .setup(|app| {
            info!("🚀 Starting ELIZA Game - Rust Backend");

            // Get resource directory for runtime detection
            let resource_dir = match app.path().resource_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    error!("Failed to get resource directory: {}", e);
                    return Err(Box::new(std::io::Error::new(std::io::ErrorKind::NotFound, "Resource directory not found")));
                }
            };

            info!("📁 Resource directory: {:?}", resource_dir);

            // Initialize startup manager
            let startup_manager = StartupManager::new(app.handle().clone());
            let startup_manager_arc = Arc::new(Mutex::new(startup_manager));
            app.manage(startup_manager_arc.clone());

            // Initialize runtime status tracking (legacy support)
            let runtime_status = Arc::new(std::sync::Mutex::new(RuntimeDetectionStatus::default()));
            app.manage(runtime_status.clone());

            // Note: AgentManager deprecated - StartupManager uses ContainerManager instead

            // Initialize container manager for Tauri commands
            // Note: This will be replaced by startup manager's instance once initialized
            let initial_container_manager = match ContainerManager::new(crate::backend::ContainerRuntimeType::Podman) {
                Ok(manager) => Arc::new(manager),
                Err(e) => {
                    error!("Failed to create initial container manager: {}", e);
                    // Create a dummy manager to prevent panics
                    Arc::new(ContainerManager::new(crate::backend::ContainerRuntimeType::Docker).unwrap_or_else(|_| {
                        panic!("Failed to create any container manager")
                    }))
                }
            };
            app.manage(initial_container_manager.clone());

            // Initialize WebSocket manager (legacy)
            let agent_id = "2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f".to_string(); // Default agent ID
            let ws_manager = Arc::new(Mutex::new(WebSocketManager::new(app.handle().clone(), agent_id.clone())));
            app.manage(ws_manager.clone());

            // Initialize Socket.IO manager
            let socketio_manager = Arc::new(Mutex::new(SocketIOManager::new(app.handle().clone(), agent_id)));
            app.manage(socketio_manager.clone());

            // Start the callback server for receiving real-time updates on available port
            tauri::async_runtime::spawn(async move {
                // Try different ports to avoid conflicts
                let ports = [8888, 8889, 8890, 8891, 8892];
                let mut callback_started = false;
                
                for port in ports {
                    info!("🔗 Trying to start Tauri callback server on port {}...", port);
                    match start_callback_server_on_port(port).await {
                        Ok(_) => {
                            info!("✅ Callback server started successfully on port {}", port);
                            callback_started = true;
                            break;
                        }
                        Err(e) => {
                            warn!("❌ Failed to start callback server on port {}: {}", port, e);
                        }
                    }
                }
                
                if !callback_started {
                    error!("❌ Failed to start callback server on any available port");
                }
            });

            // Start the initialization sequence in background
            let resource_dir_clone = resource_dir.clone();
            let startup_manager_clone = startup_manager_arc.clone();
            let _ws_manager_clone = ws_manager.clone();
            let socketio_manager_clone = socketio_manager.clone();
            
            tauri::async_runtime::spawn(async move {
                let mut manager = startup_manager_clone.lock().await;
                let startup_result = manager.start_initialization(resource_dir_clone).await;
                
                if let Err(e) = startup_result {
                    error!("❌ Startup initialization failed: {}", e);
                } else {
                    info!("✅ Startup initialization completed successfully");
                }
                
                // Always attempt Socket.IO connection, even if startup failed
                // This allows testing with the test Socket.IO server
                info!("🔌 Attempting Socket.IO connection to test server...");
                let mut socketio_mgr = socketio_manager_clone.lock().await;
                if let Err(e) = socketio_mgr.connect("http://localhost:7777").await {
                    error!("Failed to connect Socket.IO: {}", e);
                } else {
                    info!("✅ Socket.IO connected successfully");
                    
                    // Join the game UI room
                    let room_id = "3a3cab1f-9055-0b62-a4b5-23db6cd653d7".to_string(); // Game UI room
                    if let Err(e) = socketio_mgr.join_room(room_id.clone()).await {
                        error!("Failed to join Socket.IO room {}: {}", room_id, e);
                    } else {
                        info!("📍 Joined Socket.IO room: {}", room_id);
                    }
                    
                    // Start listening for messages (Socket.IO uses event callbacks)
                    let socketio_listener = socketio_manager_clone.clone();
                    tokio::spawn(async move {
                        if let Err(e) = SocketIOManager::listen_for_messages(socketio_listener).await {
                            error!("Socket.IO listener error: {}", e);
                        }
                    });
                }
            });

            // Setup cleanup on app exit
            let startup_manager_cleanup = startup_manager_arc.clone();
            
            #[cfg(desktop)]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { .. } = event {
                            info!("App closing, cleaning up resources...");

                            // Stop containers if available
                            let container_manager = tauri::async_runtime::block_on(async {
                                let manager = startup_manager_cleanup.lock().await;
                                manager.get_container_manager()
                            });
                            
                            if let Some(container_manager) = container_manager {
                                tauri::async_runtime::block_on(async {
                                    if let Err(e) = container_manager.stop_containers().await {
                                        error!("Failed to stop containers during cleanup: {}", e);
                                    }
                                });
                            }
                            
                            info!("Cleanup completed");
                        }
                    });
                }
            }

            info!("✅ Rust backend setup completed - waiting for initialization");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                info!("Application exiting, performing final cleanup...");
                // Final cleanup is handled by the window close event above
            }
        });
}
