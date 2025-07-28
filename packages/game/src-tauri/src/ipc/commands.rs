use crate::{backend::*, container::*};
use reqwest;
use serde_json;
use std::sync::Arc;
use tauri::{Manager, State};
use tracing::{error, info, warn};

// Container management commands
/// Gets the status of all managed containers.
///
/// # Errors
///
/// Returns an error if the container manager fails to retrieve container statuses.
#[tauri::command]
pub async fn get_container_status_new(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<Vec<ContainerStatus>, String> {
    match state.get_all_statuses().await {
        Ok(statuses) => Ok(statuses),
        Err(e) => {
            error!("Failed to get container status: {}", e);
            Err(e.to_string())
        }
    }
}

/// Starts a PostgreSQL container with default configuration.
///
/// # Errors
///
/// Returns an error if the container runtime fails to start the PostgreSQL container.
#[tauri::command]
pub async fn start_postgres_container(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<ContainerStatus, String> {
    match state.start_postgres().await {
        Ok(status) => {
            info!("PostgreSQL container started successfully");
            Ok(status)
        }
        Err(e) => {
            error!("Failed to start PostgreSQL container: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn start_ollama_container(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<ContainerStatus, String> {
    match state.start_ollama().await {
        Ok(status) => {
            info!("Ollama container started successfully");
            Ok(status)
        }
        Err(e) => {
            error!("Failed to start Ollama container: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn start_agent_container(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<ContainerStatus, String> {
    match state.start_agent().await {
        Ok(status) => {
            info!("ElizaOS Agent container started successfully");
            Ok(status)
        }
        Err(e) => {
            error!("Failed to start ElizaOS Agent container: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn restart_container_new(
    state: State<'_, Arc<ContainerManager>>,
    container_name: String,
) -> Result<ContainerStatus, String> {
    match state.restart_container(&container_name).await {
        Ok(status) => {
            info!("Container {} restarted successfully", container_name);
            Ok(status)
        }
        Err(e) => {
            error!("Failed to restart container {}: {}", container_name, e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_container_new(
    state: State<'_, Arc<ContainerManager>>,
    container_name: String,
) -> Result<(), String> {
    match state.stop_container(&container_name).await {
        Ok(()) => {
            info!("Container {} stopped successfully", container_name);
            Ok(())
        }
        Err(e) => {
            error!("Failed to stop container {}: {}", container_name, e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_all_containers_new(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<(), String> {
    match state.stop_containers().await {
        Ok(()) => {
            info!("All containers stopped successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to stop all containers: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn setup_complete_environment_new(
    state: State<'_, Arc<ContainerManager>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    match state.setup_complete_environment(&resource_dir).await {
        Ok(()) => {
            info!("Complete environment setup finished successfully");
            Ok("Environment setup completed successfully".to_string())
        }
        Err(e) => {
            error!("Failed to setup complete environment: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn get_setup_progress_new(
    state: State<'_, Arc<ContainerManager>>,
) -> Result<SetupProgress, String> {
    Ok(state.get_setup_progress().await)
}

// Agent capability management commands

#[tauri::command]
pub async fn toggle_autonomy(enable: bool) -> Result<serde_json::Value, String> {
    let endpoint = if enable {
        "/autonomy/enable"
    } else {
        "/autonomy/disable"
    };
    match make_agent_server_request("POST", endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to toggle autonomy: {}", e)),
    }
}

#[tauri::command]
pub async fn get_autonomy_status() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/autonomy/status", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to get autonomy status: {}", e)),
    }
}

#[tauri::command]
pub async fn toggle_capability(capability: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/agents/default/capabilities/{}/toggle", capability);
    match make_agent_server_request("POST", &endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to toggle {} capability: {}", capability, e)),
    }
}

#[tauri::command]
pub async fn get_capability_status(capability: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/api/agents/default/capabilities/{}", capability);
    match make_agent_server_request("GET", &endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!(
            "Failed to get {} capability status: {}",
            capability, e
        )),
    }
}

#[tauri::command]
pub async fn update_agent_setting(
    key: String,
    value: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "key": key,
        "value": value
    });

    match make_agent_server_request("POST", "/api/agents/default/settings", Some(payload)).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to update setting {}: {}", key, e)),
    }
}

#[tauri::command]
pub async fn get_agent_settings() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/api/agents/default/settings", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to get agent settings: {}", e)),
    }
}

#[tauri::command]
pub async fn get_vision_settings() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/api/agents/default/settings/vision", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to get vision settings: {}", e)),
    }
}

#[tauri::command]
pub async fn refresh_vision_service() -> Result<serde_json::Value, String> {
    match make_agent_server_request("POST", "/api/agents/default/vision/refresh", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to refresh vision service: {}", e)),
    }
}

// Helper function to make requests to the agent server
async fn make_agent_server_request(
    method: &str,
    endpoint: &str,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:7777{}", endpoint);

    let mut request = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err("Invalid HTTP method".into()),
    };

    if let Some(json_body) = body {
        request = request.json(&json_body);
    }

    let response = request
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;

    if response.status().is_success() {
        let data: serde_json::Value = response.json().await?;
        Ok(data)
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!(
            "Agent server responded with status: {} - {}",
            status, error_text
        )
        .into())
    }
}

// Data fetching commands
#[tauri::command]
pub async fn fetch_goals() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/api/goals", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch goals: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_todos() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/api/todos", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch todos: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_knowledge_files() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/knowledge/documents", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch knowledge files: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_knowledge_file(file_id: String) -> Result<serde_json::Value, String> {
    let endpoint = format!("/knowledge/documents/{}", file_id);
    match make_agent_server_request("DELETE", &endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to delete knowledge file: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_plugin_configs() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/api/plugin-config", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch plugin configs: {}", e)),
    }
}

#[tauri::command]
pub async fn update_plugin_config(
    plugin: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "plugin": plugin,
        "config": config
    });

    match make_agent_server_request("POST", "/api/plugin-config", Some(body)).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to update plugin config: {}", e)),
    }
}

#[tauri::command]
pub async fn validate_configuration() -> Result<serde_json::Value, String> {
    match make_agent_server_request("POST", "/api/config/validate", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to validate configuration: {}", e)),
    }
}

#[tauri::command]
pub async fn test_configuration() -> Result<serde_json::Value, String> {
    match make_agent_server_request("POST", "/api/config/test", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to test configuration: {}", e)),
    }
}

#[tauri::command]
pub async fn reset_agent() -> Result<serde_json::Value, String> {
    match make_agent_server_request("POST", "/api/reset-agent", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to reset agent: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_autonomy_status() -> Result<serde_json::Value, String> {
    match make_agent_server_request("GET", "/autonomy/status", None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch autonomy status: {}", e)),
    }
}

#[tauri::command]
pub async fn fetch_memories(params: serde_json::Value) -> Result<serde_json::Value, String> {
    // Convert the params object to query string parameters
    let mut query_params = vec![];

    if let Some(room_id) = params.get("roomId").and_then(|v| v.as_str()) {
        query_params.push(format!("roomId={}", room_id));
    }
    if let Some(count) = params.get("count").and_then(|v| v.as_u64()) {
        query_params.push(format!("count={}", count));
    }
    if let Some(entity_id) = params.get("entityId").and_then(|v| v.as_str()) {
        query_params.push(format!("entityId={}", entity_id));
    }
    if let Some(world_id) = params.get("worldId").and_then(|v| v.as_str()) {
        query_params.push(format!("worldId={}", world_id));
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let endpoint = format!("/api/memories{}", query_string);

    match make_agent_server_request("GET", &endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to fetch memories: {}", e)),
    }
}

// Health check command
#[tauri::command]
pub async fn health_check() -> Result<String, String> {
    let health_status = serde_json::json!({
        "status": "healthy",
        "backend": "rust",
        "timestamp": chrono::Utc::now().timestamp(),
        "components": {
            "container_manager": "operational",
            "agent_manager": "operational",
            "http_server": "operational"
        }
    });

    Ok(health_status.to_string())
}

// Knowledge management commands
#[tauri::command]
pub async fn upload_knowledge_file(
    file_name: String,
    content: String,
    mime_type: String,
) -> Result<serde_json::Value, String> {
    use serde_json::Value;
    use std::io::Write;
    use tempfile::Builder;
    use base64::{Engine as _, engine::general_purpose};

    // Create a temporary file to store the uploaded content
    let mut temp_file = Builder::new()
        .prefix("upload-")
        .suffix(&format!("-{}", file_name))
        .tempfile()
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;

    // Decode base64 content using the new Engine API
    let decoded_content = general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;

    // Write content to temp file
    temp_file
        .write_all(&decoded_content)
        .map_err(|e| format!("Failed to write to temporary file: {}", e))?;
    
    // Create multipart form
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(decoded_content)
                .file_name(file_name.clone())
                .mime_str(&mime_type)
                .map_err(|e| format!("Failed to set MIME type: {}", e))?,
        );

    // Make request to upload endpoint
    let client = reqwest::Client::new();
    let url = "http://localhost:7777/knowledge/upload";
    
    let response = client
        .post(url)
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to upload file: {}", e))?;

    if response.status().is_success() {
        let data: Value = response.json().await
            .map_err(|e| format!("Failed to parse upload response: {}", e))?;
        Ok(data)
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Upload failed with status {}: {}", status, error_text))
    }
}

// Goal management commands
#[tauri::command]
pub async fn create_goal(
    name: String,
    description: String,
    metadata: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "name": name,
        "description": description,
        "metadata": metadata.unwrap_or(serde_json::json!({}))
    });

    match make_agent_server_request("POST", "/api/goals", Some(payload)).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to create goal: {}", e)),
    }
}

// Todo management commands
#[tauri::command]
pub async fn create_todo(
    name: String,
    description: Option<String>,
    priority: Option<i32>,
    todo_type: Option<String>,
) -> Result<serde_json::Value, String> {
    let payload = serde_json::json!({
        "name": name,
        "description": description,
        "priority": priority.unwrap_or(1),
        "type": todo_type.unwrap_or_else(|| "one-off".to_string())
    });

    match make_agent_server_request("POST", "/api/todos", Some(payload)).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Failed to create todo: {}", e)),
    }
}

// Logs endpoint
#[tauri::command]
pub async fn fetch_logs(
    log_type: Option<String>,
    limit: Option<i32>,
) -> Result<serde_json::Value, String> {
    let mut query_params = vec![];
    
    if let Some(t) = log_type {
        query_params.push(format!("type={}", t));
    }
    if let Some(l) = limit {
        query_params.push(format!("limit={}", l));
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let endpoint = format!("/api/logs{}", query_string);

    match make_agent_server_request("GET", &endpoint, None).await {
        Ok(response) => Ok(response),
        Err(e) => {
            // If logs endpoint doesn't exist on server, return empty logs
            warn!("Logs endpoint not available: {}", e);
            Ok(serde_json::json!({
                "success": true,
                "data": {
                    "logs": []
                }
            }))
        }
    }
}
