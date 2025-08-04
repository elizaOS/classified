/**
 * Agent management commands
 * Handles agent settings, autonomy, capabilities, and agent state
 */
use crate::backend;
use crate::common::http_client::agent_server_request;
use crate::CrashFile;
use backend::state::GlobalAppState;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub async fn toggle_autonomy(enable: bool) -> Result<serde_json::Value, String> {
    agent_server_request(
        "POST",
        "/api/autonomy/toggle",
        Some(json!({ "enabled": enable })),
        Some(60),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_autonomy_status() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/autonomy/status", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_autonomy_status() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/autonomy/status", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_capability(capability: String) -> Result<serde_json::Value, String> {
    agent_server_request(
        "POST",
        &format!("/api/capabilities/{}/toggle", capability),
        None,
        Some(10),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_capability_status(capability: String) -> Result<serde_json::Value, String> {
    agent_server_request(
        "GET",
        &format!("/api/capabilities/{}/status", capability),
        None,
        Some(10),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_agent_setting(
    setting_key: String,
    setting_value: serde_json::Value,
) -> Result<serde_json::Value, String> {
    agent_server_request(
        "POST",
        "/api/agent/settings",
        Some(json!({ setting_key: setting_value })),
        Some(10),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_agent_settings() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/agent/settings", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_vision_settings() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/vision/settings", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refresh_vision_service() -> Result<serde_json::Value, String> {
    match agent_server_request("POST", "/api/vision/refresh", None, Some(10)).await {
        Ok(response) => Ok(response),
        Err(e) => {
            if e.to_string().contains("Connection refused")
                || e.to_string().contains("agent is not running")
            {
                // Agent is not running, return a default response
                Ok(json!({
                    "status": "offline",
                    "message": "Agent is not running",
                    "available": false,
                    "models": [],
                    "activeModel": null
                }))
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
pub async fn reset_agent(
    _global_state: State<'_, GlobalAppState>,
    crash_file: State<'_, CrashFile>,
) -> Result<serde_json::Value, String> {
    // Clear crash state by removing the file
    if crash_file.0.exists() {
        std::fs::remove_file(&crash_file.0).map_err(|e| e.to_string())?;
    }
    
    // Reset global state - for now we don't need to reset container manager or backup manager
    // as those are infrastructure components that should persist
    // The agent reset command already handles agent-specific state reset
    
    agent_server_request("POST", "/api/agent/reset", None, Some(60))
        .await
        .map_err(|e| e.to_string())
}