/**
 * Core Tauri commands for basic application functionality
 * Includes greeting, startup status, user configuration, and message routing
 */
use crate::common::agent_server_request;
use crate::config;
use crate::container::*;
use crate::startup::*;
use crate::{error_recovery, server};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!(
        "Hello, {}! You've been greeted from the Rust backend!",
        name
    )
}

#[tauri::command]
pub async fn get_container_runtime_status(
    runtime_status: State<'_, Arc<std::sync::Mutex<RuntimeDetectionStatus>>>,
) -> Result<RuntimeDetectionStatus, String> {
    let status = runtime_status
        .lock()
        .map_err(|e| format!("Failed to lock runtime status: {}", e))?;
    Ok(status.clone())
}

#[tauri::command]
pub async fn get_startup_status(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
) -> Result<StartupStatus, String> {
    let manager = startup_manager.lock().await;
    Ok(manager.get_status())
}

#[tauri::command]
pub async fn submit_user_config(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    config: UserConfig,
) -> Result<(), String> {
    info!("📝 Received user configuration from frontend");

    let mut manager = startup_manager.lock().await;
    manager
        .handle_user_config(config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Route a message to the agent with automatic error recovery
async fn route_message_to_agent(
    message: &str,
    container_manager: Option<Arc<ContainerManager>>,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();

    // Get the dynamic agent port
    let agent_port = if let Some(manager) = &container_manager {
        let port_config = manager.get_port_config().await;
        port_config.agent_port
    } else {
        7777 // Default fallback
    };

    // Use configured room and agent IDs
    let room_id = config::get_room_id();
    let _agent_id = config::get_agent_id();

    // Define the request operation as a closure
    let attempt_request = || async {
        // First, ensure the room/channel exists in the messaging system
        let channel_url = format!(
            "http://localhost:{}/api/messaging/central-channels/{}",
            agent_port, room_id
        );
        let channel_check = client.get(&channel_url).send().await;

        if channel_check.is_err() || !channel_check.unwrap().status().is_success() {
            info!("Channel doesn't exist in messaging system, creating it...");

            // Try to create the channel
            let create_channel_url = format!(
                "http://localhost:{}/api/messaging/central-channels",
                agent_port
            );
            let _ = client
                .post(&create_channel_url)
                .json(&serde_json::json!({
                    "id": room_id,
                    "server_id": "00000000-0000-0000-0000-000000000000",
                    "name": "Game UI Channel",
                    "type": "game",
                    "metadata": {
                        "source": "eliza_game"
                    }
                }))
                .send()
                .await;
        }

        // Use the ingest-external endpoint which works properly
        let message_url = format!(
            "http://localhost:{}/api/messaging/ingest-external",
            agent_port
        );

        let response = client
            .post(&message_url)
            .json(&serde_json::json!({
                "channel_id": room_id,
                "server_id": "00000000-0000-0000-0000-000000000000",
                "author_id": "00000000-0000-0000-0000-000000000001", // Fixed user ID
                "author_display_name": "Admin",
                "content": message,
                "source_type": "game_ui",
                "raw_message": {
                    "text": message,
                    "type": "user_message"
                },
                "metadata": {
                    "source": "eliza_game",
                    "userName": "Admin"
                }
            }))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if response.status().is_success() {
            // For the ingest-external endpoint, we get an acknowledgment but not the actual response
            let _response_data: serde_json::Value = response.json().await?;
            Ok(format!("Message sent to agent: {}", message))
                as Result<String, Box<dyn std::error::Error + Send + Sync>>
        } else {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(format!("Agent responded with status: {} - {}", status, error_text).into())
                as Result<String, Box<dyn std::error::Error + Send + Sync>>
        }
    };

    // Use centralized error recovery logic
    error_recovery::retry_with_recovery(
        attempt_request,
        container_manager,
        "route message to agent"
    ).await
    .map_err(|e| e.into())
}

#[tauri::command]
pub async fn send_message_to_agent(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    native_ws_client: State<'_, Arc<server::websocket::WebSocketClient>>,
    container_manager: State<'_, Arc<ContainerManager>>,
    message: String,
) -> Result<String, String> {
    info!("💬 Received message from frontend: {}", message);

    let manager = startup_manager.lock().await;
    if !manager.is_ready() {
        return Err("System is not ready for messages yet".to_string());
    }
    drop(manager);

    // Try native WebSocket first (real-time communication)
    if native_ws_client.is_connected().await {
        info!("📡 Sending message via native WebSocket");
        match native_ws_client.send_message(&message).await {
            Ok(_) => {
                info!("✅ Message sent via WebSocket successfully");
                return Ok(
                    "Message sent via WebSocket - response will arrive via real-time events"
                        .to_string(),
                );
            }
            Err(e) => {
                warn!("⚠️ WebSocket send failed, falling back to HTTP: {}", e);
            }
        }
    }

    // Fallback to HTTP API if WebSocket is not available
    info!("🔄 Falling back to HTTP API for message delivery");
    
    // Use centralized error recovery logic
    let recovery_result = error_recovery::execute_with_recovery(
        || async {
            route_message_to_agent(&message, Some(container_manager.inner().clone())).await
        },
        Some(container_manager.inner().clone()),
        error_recovery::RecoveryConfig::default(),
        "HTTP message delivery"
    ).await;

    match recovery_result.result {
        Ok(response) => {
            if recovery_result.recovery_attempted {
                info!(
                    "✅ Message delivered after {} attempts (recovery: {})",
                    recovery_result.attempts_made,
                    if recovery_result.recovery_succeeded { "succeeded" } else { "failed" }
                );
            }
            Ok(response)
        }
        Err(e) => {
            error!(
                "❌ Both WebSocket and HTTP communication failed after {} attempts: {}",
                recovery_result.attempts_made, e
            );
            Err(format!("Both WebSocket and HTTP communication failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn start_game_environment(
    _startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<(), String> {
    info!("🎮 Starting game environment from frontend request");

    // Use ContainerManager to set up the complete environment
    // For now, use current directory as resource directory
    let resource_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    container_manager
        .setup_complete_environment(&resource_dir)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn wait_for_server(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<bool, String> {
    info!("⏳ Frontend requested to wait for server readiness");

    let port_config = container_manager.get_port_config().await;
    let agent_port = port_config.agent_port;

    let _client = reqwest::Client::new();

    // Try up to 20 times with 5-second intervals (100 seconds total)
    for attempt in 1..=20 {
        let _health_url = format!("http://localhost:{}/health", agent_port);

        match agent_server_request("GET", "/health", None::<serde_json::Value>, Some(10)).await {
            Ok(_) => {
                info!("✅ Agent server is ready after {} attempts", attempt);
                return Ok(true);
            }
            Err(e) => {
                warn!(
                    "🔄 Agent server not ready (attempt {}/20): {}",
                    attempt, e
                );
            }
        }

        if attempt < 20 {
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    }

    warn!("❌ Agent server did not become ready after multiple attempts.");
    Ok(false)
}