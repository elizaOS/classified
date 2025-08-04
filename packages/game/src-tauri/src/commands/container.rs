/**
 * Container management commands
 * Handles Docker/Podman container operations for all services
 */
use crate::backend::state::GlobalAppState;
use crate::common::http_client::agent_server_request;
use crate::container::manager::ContainerManager;
use crate::startup::StartupManager;
use serde_json::json;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_container_status_new(
    container_name: String,
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    match container_manager.get_container_status(&container_name).await {
        Ok(status) => Ok(json!({
            "status": status,
            "running": matches!(status.state, crate::backend::types::ContainerState::Running)
        })),
        Err(e) => Err(format!("Failed to get container status: {}", e)),
    }
}

#[tauri::command]
pub async fn start_postgres_container(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    match container_manager
        .inner()
        .start_postgres()
        .await
    {
        Ok(status) => {
            // Wait for Postgres to be ready
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            Ok(json!({
                "container_id": status.id,
                "message": "PostgreSQL container started successfully"
            }))
        }
        Err(e) => Err(format!("Failed to start PostgreSQL container: {}", e)),
    }
}

#[tauri::command]
pub async fn start_ollama_container(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    match container_manager
        .inner()
        .start_ollama()
        .await
    {
        Ok(status) => Ok(json!({
            "container_id": status.id,
            "message": "Ollama container started successfully"
        })),
        Err(e) => Err(format!("Failed to start Ollama container: {}", e)),
    }
}

#[tauri::command]
pub async fn start_agent_container(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    match container_manager
        .inner()
        .start_agent()
        .await
    {
        Ok(status) => Ok(json!({
            "container_id": status.id,
            "message": "Agent container started successfully"
        })),
        Err(e) => Err(format!("Failed to start agent container: {}", e)),
    }
}

#[tauri::command]
pub async fn restart_container_new(
    container_name: String,
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    container_manager
        .restart_container(&container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "message": format!("{} container restarted", container_name) }))
}

#[tauri::command]
pub async fn stop_container_new(
    container_name: String,
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    container_manager
        .stop_container(&container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "message": format!("{} container stopped", container_name) }))
}

#[tauri::command]
pub async fn stop_all_containers_new(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    container_manager
        .stop_containers()
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "message": "All containers stopped" }))
}

#[tauri::command]
pub async fn setup_complete_environment_new(
    _startup_manager: State<'_, Arc<StartupManager>>,
    _global_state: State<'_, GlobalAppState>,
) -> Result<serde_json::Value, String> {
    // TODO: Implement full environment setup
    // For now, return a placeholder response
    Ok(json!({ 
        "message": "Environment setup feature not yet implemented",
        "status": "pending"
    }))
}

#[tauri::command]
pub async fn get_setup_progress_new(
    startup_manager: State<'_, Arc<StartupManager>>,
) -> Result<serde_json::Value, String> {
    let progress = startup_manager.inner().get_status();
    Ok(serde_json::to_value(progress).unwrap())
}

#[tauri::command]
pub async fn recover_agent_container(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    // Check if agent container exists and is stopped/exited
    let status = container_manager
        .get_container_status("eliza-agent")
        .await
        .map_err(|e| format!("Failed to check agent status: {}", e))?;

    match status.state {
        crate::backend::types::ContainerState::Running => {
            Err("Agent container is already running".to_string())
        }
        crate::backend::types::ContainerState::NotFound => {
            // Recreate container
            return container_manager
                .inner()
                .start_agent()
                .await
                .map(|status| {
                    json!({
                        "container_id": status.id,
                        "message": "Agent container recreated successfully",
                        "action": "recreated"
                    })
                })
                .map_err(|e| format!("Failed to recreate agent container: {}", e));
        }
        _ => {
            // Container exists but not running, restart it
            return container_manager
                .restart_container("eliza-agent")
                .await
                .map(|_| {
                    json!({
                        "message": "Agent container restarted successfully",
                        "action": "restarted"
                    })
                })
                .map_err(|e| format!("Failed to restart agent container: {}", e));
        }
    }
}

#[tauri::command]
pub async fn get_ollama_recommendations() -> Result<serde_json::Value, String> {
    // Try to get recommendations from the agent server
    match agent_server_request("GET", "/api/ollama/recommendations", None, Some(5)).await {
        Ok(response) => Ok(response),
        Err(_) => {
            // If agent is not running, return default recommendations
            Ok(json!({
                "recommendations": [
                    {
                        "model": "llama3.2",
                        "size": "2B",
                        "description": "Fast and efficient for basic tasks"
                    },
                    {
                        "model": "dolphin-llama3",
                        "size": "8B",
                        "description": "Good balance of speed and capability"
                    },
                    {
                        "model": "nous-hermes2",
                        "size": "11B",
                        "description": "Advanced reasoning and coding"
                    }
                ],
                "installedModels": []
            }))
        }
    }
}