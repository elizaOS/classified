// ElizaOS Game - Rust Backend Implementation
// This replaces the Node.js backend with a high-performance Rust backend

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use dashmap::DashMap;
use once_cell::sync::OnceCell;

// Global callback store
static CALLBACK_STORE: OnceCell<AgentCallbackStore> = OnceCell::new();

// New Rust backend modules
mod backend;
mod backup;
mod commands;
mod common;
mod config;
mod container;
mod error_recovery;
mod ipc;
mod server;
mod startup;
mod tests;

// Re-export common constants and utilities for tests
pub use common::{
    is_port_available, AGENT_CONTAINER, NETWORK_NAME, OLLAMA_CONTAINER, POSTGRES_CONTAINER,
};
// Export types for external use (tests, etc.)
pub use backend::{
    AgentConfig, BackendConfig, BackendError, BackendResult, ContainerConfig, ContainerRuntimeType,
    ContainerState, ContainerStatus, HealthStatus, PortMapping, SetupProgress, VolumeMount,
};
pub use container::{ContainerManager, HealthMonitor, PortConfig, RuntimeDetectionStatus};
// pub use ipc::commands::*; // Commands now in src/commands/ module
pub use server::{HttpServer, WebSocketHub};
pub use startup::{AiProvider, StartupManager, StartupStage, StartupStatus, UserConfig};

// Store crash recovery file path
pub struct CrashFile(PathBuf);

// Store agent response callbacks
pub struct AgentCallbackStore(Arc<DashMap<String, AgentResponseCallback>>);

impl Default for AgentCallbackStore {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentCallbackStore {
    pub fn new() -> Self {
        Self(Arc::new(DashMap::new()))
    }
    
    pub fn store(&self, callback: AgentResponseCallback) {
        self.0.insert(callback.message_id.clone(), callback);
    }
    
    pub fn get(&self, message_id: &str) -> Option<AgentResponseCallback> {
        self.0.get(message_id).map(|entry| entry.clone())
    }
    
    pub fn get_all(&self) -> Vec<AgentResponseCallback> {
        self.0.iter().map(|entry| entry.value().clone()).collect()
    }
    
    pub fn remove(&self, message_id: &str) -> Option<AgentResponseCallback> {
        self.0.remove(message_id).map(|(_, callback)| callback)
    }
}



// Tauri callback server for receiving real-time updates from backend
use axum::{extract::Json, response::Json as JsonResponse, routing::post, Router};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponseCallback {
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
    Json(payload): Json<AgentResponseCallback>,
) -> JsonResponse<CallbackResponse> {
    info!("🔔 Received agent response callback: {}", payload.content);

    // Store the callback in our global store
    if let Some(store) = CALLBACK_STORE.get() {
        store.store(payload.clone());
    info!(
            "📨 Agent Response stored - ID: {}, Content: '{}'",
        payload.message_id, payload.content
    );

    JsonResponse(CallbackResponse {
        success: true,
            message: format!("Agent response stored with ID: {}", payload.message_id),
        })
    } else {
        warn!("Callback store not initialized");
        JsonResponse(CallbackResponse {
            success: false,
            message: "Callback store not initialized".to_string(),
        })
    }
}

// Start the callback server on a specific port
async fn start_callback_server_on_port(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new().route("/agent-response", post(handle_agent_response_callback));

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("🔗 Tauri callback server listening on http://{}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
// WebSocket and test commands have been moved to commands/websocket.rs and commands/testing.rs

async fn wait_for_agent_server_ready(agent_port: u16) -> bool {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:{}/api/server/health", agent_port); // Health check endpoint

    for attempt in 0..20 {
        // Retry up to 20 times
        info!(
            "⏳ Waiting for agent server health check (attempt {}/20)...",
            attempt + 1
        );
        let response = client
            .get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        if let Ok(response) = response {
            if response.status().is_success() {
                info!("✅ Agent server health check successful");

                // Now check if the game API plugin routes are ready
                info!("🔍 Checking if game API plugin routes are ready...");
                let agent_id = crate::config::get_agent_id();
                let settings_url = format!(
                    "http://localhost:{}/api/agents/{}/settings",
                    agent_port, agent_id
                );
                let settings_response = client
                    .get(&settings_url)
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                    .await;

                if let Ok(settings_resp) = settings_response {
                    if settings_resp.status().is_success() {
                        info!("✅ Game API plugin routes are ready");
                        return true;
                    } else {
                        warn!(
                            "⚠️ Game API plugin routes not ready yet (status: {})",
                            settings_resp.status()
                        );
                    }
                } else {
                    warn!("⚠️ Failed to check game API plugin routes");
                }
            } else {
                let status = response.status();
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string());
                warn!(
                    "⚠️ Agent server health check failed with status: {} - {}",
                    status, error_text
                );
            }
        } else {
            let e = response.unwrap_err();
            warn!(
                "❌ Failed to send health check request to agent server: {}",
                e
            );
        }

        if attempt < 19 {
            // Don't sleep on the last attempt
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await; // Wait 5 seconds between retries
        }
    }
    warn!("❌ Agent server did not become ready after multiple attempts.");
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting ElizaOS Game with Rust backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Core commands
            commands::core::greet,
            commands::core::get_container_runtime_status,
            commands::core::get_startup_status,
            commands::core::submit_user_config,
            commands::core::send_message_to_agent,
            commands::core::start_game_environment,
            commands::core::wait_for_server,
            // Configuration management commands
            commands::configuration::get_agent_configuration,
            commands::configuration::update_agent_configuration,
            commands::configuration::get_available_providers,
            commands::configuration::validate_agent_config,
            commands::configuration::test_agent_config,
            // Container management commands
            commands::container::get_container_status_new,
            commands::container::start_postgres_container,
            commands::container::start_ollama_container,
            commands::container::start_agent_container,
            commands::container::restart_container_new,
            commands::container::stop_container_new,
            commands::container::stop_all_containers_new,
            commands::container::setup_complete_environment_new,
            commands::container::get_setup_progress_new,
            commands::container::recover_agent_container,
            commands::container::get_ollama_recommendations,
            // Agent capability management commands
            commands::agent::toggle_autonomy,
            commands::agent::get_autonomy_status,
            commands::agent::fetch_autonomy_status,
            commands::agent::toggle_capability,
            commands::agent::get_capability_status,
            commands::agent::update_agent_setting,
            commands::agent::get_agent_settings,
            commands::agent::get_vision_settings,
            commands::agent::refresh_vision_service,
            commands::agent::reset_agent,
            // Data fetching commands
            commands::data::fetch_goals,
            commands::data::fetch_todos,
            commands::data::fetch_knowledge_files,
            commands::data::delete_knowledge_file,
            commands::data::fetch_plugin_configs,
            commands::data::update_plugin_config,
            commands::data::fetch_memories,
            commands::data::upload_knowledge_file,
            commands::data::create_goal,
            commands::data::create_todo,
            commands::data::fetch_logs,
            // Testing and health checks
            commands::testing::health_check,
            commands::testing::test_configuration,
            commands::testing::validate_configuration,
            commands::websocket::connect_native_websocket,
            commands::websocket::disconnect_native_websocket,
            commands::websocket::reconnect_native_websocket,
            commands::websocket::send_native_websocket_message,
            commands::websocket::is_native_websocket_connected,
            commands::websocket::get_native_websocket_state,
            commands::websocket::test_native_websocket,
            // WebSocket commands
            commands::websocket::websocket_health,
            // Test commands
            commands::testing::run_startup_hello_world_test,
            // Media streaming commands
            commands::media::stream_media_frame,
            commands::media::stream_media_audio,
            commands::media::start_agent_screen_capture,
            commands::media::stop_agent_screen_capture,
            // Application lifecycle
            commands::app_lifecycle::shutdown_application,
            // Backup management commands
            ipc::backup::create_backup,
            ipc::backup::restore_backup,
            ipc::backup::list_backups,
            ipc::backup::delete_backup,
            ipc::backup::get_backup_config,
            ipc::backup::update_backup_config,
            ipc::backup::export_backup,
            ipc::backup::import_backup,
            // Callback management commands
            commands::callbacks::get_agent_callbacks,
            commands::callbacks::get_agent_callback,
            commands::callbacks::remove_agent_callback,
            commands::callbacks::clear_agent_callbacks,
        ])
        .setup(|app| {
            info!("🚀 Starting ELIZA Game - Rust Backend");

            // Set up crash recovery file
            let crash_file = match app.path().app_data_dir() {
                Ok(dir) => {
                    // Ensure directory exists
                    let _ = std::fs::create_dir_all(&dir);
                    dir.join(".crash_recovery")
                }
                Err(e) => {
                    warn!("Failed to get app data dir for crash recovery: {}", e);
                    std::env::temp_dir().join("eliza_crash_recovery")
                }
            };

            // If crash file exists, we crashed last time
            if crash_file.exists() {
                warn!("🚨 Detected previous crash, running recovery...");

                // Store container manager reference for recovery
                let recovery_container_manager = match ContainerManager::new_with_runtime_type(
                    crate::backend::ContainerRuntimeType::Podman,
                ) {
                    Ok(manager) => Some(Arc::new(manager)),
                    Err(e) => {
                        warn!("Failed to create container manager for recovery: {}", e);
                        None
                    }
                };

                // Run recovery in blocking context
                if let Some(manager) = recovery_container_manager {
                    tauri::async_runtime::block_on(async {
                        // Stop all containers
                        let _ = manager.stop_containers().await;

                        // Clean up orphaned containers
                        let _ = manager.cleanup_containers_by_pattern("eliza-").await;

                        info!("✅ Crash recovery completed");
                    });
                }

                // Remove crash file
                let _ = std::fs::remove_file(&crash_file);
            }

            // Create crash file (removed on clean shutdown)
            if let Err(e) = std::fs::write(&crash_file, "crashed") {
                warn!("Failed to create crash recovery file: {}", e);
            }

            // Store crash file path for cleanup on shutdown
            app.manage(CrashFile(crash_file));
            
            // Initialize callback store
            CALLBACK_STORE.set(AgentCallbackStore::new()).ok();

            // Get resource directory for runtime detection
            let resource_dir = match app.path().resource_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    error!("Failed to get resource directory: {}", e);
                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Resource directory not found",
                    )));
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

            // Initialize container manager for Tauri commands
            // Note: This will be replaced by startup manager's instance once initialized
            let initial_container_manager = match ContainerManager::new_with_runtime_type(
                crate::backend::ContainerRuntimeType::Podman,
            ) {
                Ok(manager) => Arc::new(manager),
                Err(e) => {
                    error!("Failed to create initial container manager: {}", e);
                    // Create a dummy manager to prevent panics
                    Arc::new(
                        ContainerManager::new_with_runtime_type(
                            crate::backend::ContainerRuntimeType::Docker,
                        )
                        .unwrap_or_else(|_| panic!("Failed to create any container manager")),
                    )
                }
            };
            app.manage(initial_container_manager.clone());

            // Initialize operation lock manager
            let operation_lock = Arc::new(crate::container::OperationLock::new());
            app.manage(operation_lock.clone());

            // Initialize Native WebSocket client (App Store friendly)
            let native_ws_client = Arc::new(server::websocket::WebSocketClient::new(
                app.handle().clone(),
                crate::config::get_agent_id().to_string(), // Default agent ID
            ));
            app.manage(native_ws_client.clone());

            // Initialize backup system
            let backup_manager = Arc::new(tokio::sync::RwLock::new(
                backup::manager::BackupManager::new(
                    initial_container_manager.clone(),
                    app.handle().clone(),
                ),
            ));
            let backup_scheduler = Arc::new(tokio::sync::RwLock::new(
                backup::scheduler::BackupScheduler::new(backup_manager.clone()),
            ));

            // Create global app state
            let global_state = backend::state::GlobalAppState::new(
                initial_container_manager.clone(),
                backup_manager.clone(),
            );
            app.manage(global_state);

            // Start the backup scheduler
            let scheduler_clone = backup_scheduler.clone();
            tauri::async_runtime::spawn(async move {
                scheduler_clone.read().await.start().await;
            });

            // Start the callback server for receiving real-time updates on available port
            tauri::async_runtime::spawn(async move {
                // Use less common ports starting with 7773 to avoid conflicts
                // Note: 7777 is reserved for the agent server, so we avoid it
                let ports = [7773, 7774, 7775, 7776];
                let mut callback_started = false;

                for port in ports {
                    info!(
                        "🔗 Trying to start Tauri callback server on port {}...",
                        port
                    );

                    // First, try to kill any existing processes on this port
                    if let Err(e) = common::kill_processes_on_port(port).await {
                        warn!("⚠️ Failed to clean up port {}: {}", port, e);
                    }

                    // Small delay to let the port become available
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

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
            let native_ws_clone = native_ws_client.clone();
            let app_handle_clone = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let mut manager = startup_manager_clone.lock().await;
                let startup_result = manager.start_initialization(resource_dir_clone).await;

                if let Err(e) = startup_result {
                    error!("❌ Startup initialization failed: {}", e);
                } else {
                    info!("✅ Startup initialization completed successfully");

                    // Wait for agent server to be fully ready before running tests
                    info!("⏳ Waiting for agent server to be fully ready...");

                    // Get the dynamic agent port from container manager
                    let container_manager: Arc<ContainerManager> = app_handle_clone
                        .state::<Arc<ContainerManager>>()
                        .inner()
                        .clone();
                    let port_config = container_manager.get_port_config().await;
                    let agent_port = port_config.agent_port;

                    let agent_ready = wait_for_agent_server_ready(agent_port).await;

                    if !agent_ready {
                        error!("❌ Agent server failed to become ready after waiting");
                        std::process::exit(1);
                    }

                    info!("✅ Agent server is ready, running tests...");

                    // Run comprehensive runtime tests only if explicitly requested
                    drop(manager); // Release the lock before running tests

                    if std::env::var("RUN_TAURI_TESTS").unwrap_or_default() == "true" {
                        info!("🧪 RUN_TAURI_TESTS=true detected, running runtime tests...");

                        // NOTE: run_all_tests will call std::process::exit(1) on test failure
                        // This ensures the app doesn't start with failing tests
                        if let Err(e) = crate::tests::run_all_tests(app_handle_clone.clone()).await
                        {
                            // This code is unreachable if tests fail (app exits), but handles other errors
                            error!("❌ Runtime tests error: {}", e);
                            std::process::exit(1);
                        }
                    } else {
                        info!("🚀 Skipping runtime tests (set RUN_TAURI_TESTS=true to run them)");
                    }
                }

                // Use native WebSocket client for real-time communication with agent server
                info!("🔌 Attempting native WebSocket connection to agent server...");

                // Helper function to connect with retry logic
                async fn connect_with_retry(
                    ws_client: Arc<server::websocket::WebSocketClient>,
                    url: &str,
                    max_attempts: u32,
                ) -> Result<(), Box<dyn std::error::Error>> {
                    use tokio::time::{sleep, Duration};

                    let mut attempts = 0;
                    let mut delay = Duration::from_millis(500);

                    while attempts < max_attempts {
                        info!(
                            "🔌 WebSocket connection attempt {} of {}",
                            attempts + 1,
                            max_attempts
                        );

                        match ws_client.connect(url).await {
                            Ok(_) => {
                                info!("✅ WebSocket connected successfully");
                                return Ok(());
                            }
                            Err(e) => {
                                attempts += 1;
                                if attempts >= max_attempts {
                                    return Err(e);
                                }

                                warn!(
                                    "WebSocket connection failed: {}. Retrying in {:?}...",
                                    e, delay
                                );
                                sleep(delay).await;

                                // Exponential backoff with max delay of 5 seconds
                                delay = std::cmp::min(delay * 2, Duration::from_secs(5));
                            }
                        }
                    }

                    Err("Max connection attempts reached".into())
                }

                // Wait a bit for the agent server to be ready
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                // Try to connect with retries
                let container_manager: Arc<ContainerManager> = app_handle_clone
                    .state::<Arc<ContainerManager>>()
                    .inner()
                    .clone();
                let port_config = container_manager.get_port_config().await;
                let ws_url = format!("ws://localhost:{}/ws", port_config.agent_port);

                if port_config.agent_port != 7777 {
                    info!(
                        "🔌 Using alternative agent port {} for WebSocket connection",
                        port_config.agent_port
                    );
                }

                if let Err(e) = connect_with_retry(native_ws_clone, &ws_url, 5).await {
                    error!("Failed to connect WebSocket after retries: {}", e);
                    info!("💡 Agent server may not be running - messages will fallback to HTTP");
                } else {
                    info!("📡 Real-time communication with agent server established");
                }
            });

            // Setup cleanup on app exit
            #[cfg(desktop)]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            info!("Close requested - initiating graceful shutdown");

                            // Prevent the default close behavior
                            api.prevent_close();

                            // Emit an event to trigger the shutdown process
                            let _ = app_handle.emit("request-shutdown", ());
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
                info!("Application exiting gracefully");
                // Note: No cleanup needed - containers left running for development
            }
        });
}
