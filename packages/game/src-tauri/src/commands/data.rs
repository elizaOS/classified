/**
 * Data management commands
 * Handles goals, todos, knowledge files, memories, and other data operations
 */
use crate::common::http_client::agent_server_request;
use serde_json::json;

use base64::{Engine as _, engine::general_purpose};

#[tauri::command]
pub async fn fetch_goals() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/goals", None, Some(10))
        .await
        .map_err(|e| format!("Failed to fetch goals: {}", e))
}

#[tauri::command]
pub async fn fetch_todos() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/todos", None, Some(10))
        .await
        .map_err(|e| format!("Failed to fetch todos: {}", e))
}

#[tauri::command]
pub async fn create_goal(
    name: String,
    description: String,
    metadata: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let body = json!({
        "name": name,
        "description": description,
        "metadata": metadata.unwrap_or(json!({}))
    });

    agent_server_request("POST", "/api/goals", Some(body), Some(10))
        .await
        .map_err(|e| format!("Failed to create goal: {}", e))
}

#[tauri::command]
pub async fn create_todo(
    name: String,
    description: Option<String>,
    priority: Option<i32>,
    todo_type: Option<String>,
) -> Result<serde_json::Value, String> {
    let body = json!({
        "name": name,
        "description": description.unwrap_or_default(),
        "priority": priority.unwrap_or(2),
        "type": todo_type.unwrap_or_else(|| "task".to_string())
    });

    agent_server_request("POST", "/api/todos", Some(body), Some(10))
        .await
        .map_err(|e| format!("Failed to create todo: {}", e))
}

#[tauri::command]
pub async fn fetch_knowledge_files() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/knowledge", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_knowledge_file(file_id: String) -> Result<serde_json::Value, String> {
    agent_server_request("DELETE", &format!("/api/knowledge/{}", file_id), None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_knowledge_file(
    file_name: String,
    file_data: Vec<u8>,
) -> Result<serde_json::Value, String> {
    // Convert file data to base64 for JSON transport
    let base64_data = general_purpose::STANDARD.encode(&file_data);
    
    let body = json!({
        "fileName": file_name,
        "fileData": base64_data
    });

    agent_server_request("POST", "/api/knowledge/upload", Some(body), Some(30))
        .await
        .map_err(|e| format!("Failed to upload knowledge file: {}", e))
}

#[tauri::command]
pub async fn fetch_memories(params: serde_json::Value) -> Result<serde_json::Value, String> {
    // Extract parameters with defaults
    let page = params.get("page").and_then(|v| v.as_u64()).unwrap_or(1);
    let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(50);
    let search = params
        .get("search")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let from_date = params.get("fromDate").and_then(|v| v.as_str());
    let to_date = params.get("toDate").and_then(|v| v.as_str());

    // Build query parameters
    let mut query_params = vec![
        format!("page={}", page),
        format!("limit={}", limit),
        format!("search={}", search),
    ];

    if let Some(from) = from_date {
        query_params.push(format!("fromDate={}", from));
    }
    if let Some(to) = to_date {
        query_params.push(format!("toDate={}", to));
    }

    let query_string = query_params.join("&");
    let endpoint = format!("/api/memories?{}", query_string);

    agent_server_request("GET", &endpoint, None, Some(10))
        .await
        .map_err(|e| format!("Failed to fetch memories: {}", e))
}

#[tauri::command]
pub async fn fetch_plugin_configs() -> Result<serde_json::Value, String> {
    agent_server_request("GET", "/api/plugins/configs", None, Some(10))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_plugin_config(
    plugin_name: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    agent_server_request(
        "PUT",
        &format!("/api/plugins/{}/config", plugin_name),
        Some(config),
        Some(10),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_logs(
    source: Option<String>,
    level: Option<String>,
    limit: Option<i32>,
) -> Result<serde_json::Value, String> {
    let mut query_params = vec![];
    
    if let Some(src) = source {
        query_params.push(format!("source={}", src));
    }
    if let Some(lvl) = level {
        query_params.push(format!("level={}", lvl));
    }
    if let Some(lim) = limit {
        query_params.push(format!("limit={}", lim));
    } else {
        query_params.push("limit=100".to_string());
    }

    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let endpoint = format!("/api/logs{}", query_string);

    match agent_server_request("GET", &endpoint, None, Some(10)).await {
        Ok(mut response) => {
            // Ensure we have a logs array
            if response.get("logs").is_none() {
                response["logs"] = json!([]);
            }
            Ok(response)
        }
        Err(e) => {
            // Return empty logs array on error
            Ok(json!({
                "logs": [],
                "error": e.to_string()
            }))
        }
    }
}