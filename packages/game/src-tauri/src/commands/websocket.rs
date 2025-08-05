/**
 * WebSocket commands
 * Handles WebSocket connections and real-time communication
 */
use crate::server::websocket::WebSocketClient;
use serde_json::json;
use std::sync::Arc;
use tauri::State;
use tracing::{error, info};

#[tauri::command]
pub async fn websocket_health() -> Result<serde_json::Value, String> {
    Ok(json!({
        "status": "ready",
        "message": "WebSocket service is available"
    }))
}

#[tauri::command]
pub async fn connect_native_websocket(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
    url: String,
) -> Result<(), String> {
    info!("🔌 Connecting to WebSocket server: {}", url);

    native_ws_client.connect(&url).await.map_err(|e| {
        error!("Failed to connect to WebSocket: {}", e);
        format!("Failed to connect: {}", e)
    })
}

#[tauri::command]
pub async fn disconnect_native_websocket(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
) -> Result<(), String> {
    info!("🔌 Disconnecting from WebSocket server");
    native_ws_client.disconnect().await;
    Ok(())
}

#[tauri::command]
pub async fn reconnect_native_websocket(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
    url: String,
) -> Result<(), String> {
    info!("🔄 Reconnecting to WebSocket server: {}", url);
    native_ws_client.reconnect(&url).await;
    Ok(())
}

#[tauri::command]
pub async fn send_native_websocket_message(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
    message: String,
) -> Result<(), String> {
    info!("📤 Sending WebSocket message: {}", message);

    native_ws_client.send_message(&message).await.map_err(|e| {
        error!("Failed to send WebSocket message: {}", e);
        format!("Failed to send message: {}", e)
    })
}

#[tauri::command]
pub async fn is_native_websocket_connected(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
) -> Result<bool, String> {
    Ok(native_ws_client.is_connected().await)
}

#[tauri::command]
pub async fn get_native_websocket_state(
    native_ws_client: State<'_, Arc<WebSocketClient>>,
) -> Result<String, String> {
    let state = native_ws_client.get_connection_state().await;
    Ok(format!("{:?}", state))
}

#[tauri::command]
pub async fn test_native_websocket(
    native_ws: State<'_, Arc<WebSocketClient>>,
) -> Result<String, String> {
    info!("🧪 Testing native WebSocket connection");

    // Check if connected and connect if needed
    if !native_ws.is_connected().await {
        native_ws
            .connect("ws://localhost:7777/ws")
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;
    }

    // Send test message
    native_ws
        .send_message("hello from tauri! repeat back this message if you can read it!")
        .await
        .map_err(|e| format!("Failed to send test message: {}", e))?;

    Ok("Test message sent successfully".to_string())
}