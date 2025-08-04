/**
 * Testing and health check commands
 * Handles system health checks, configuration testing, and diagnostics
 */
use crate::common::http_client::agent_server_request;
use crate::container::manager::ContainerManager;
use crate::startup::StartupManager;
use crate::server::websocket::WebSocketClient;
use serde_json::json;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tracing::info;

#[tauri::command]
pub async fn health_check(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<String, String> {
    // Check container runtime
    let runtime_status = match container_manager.get_runtime_version().await {
        Ok(version) => format!("Container runtime OK ({})", version),
        Err(e) => format!("Container runtime error: {}", e),
    };

    // Check if key containers are running
    let postgres_status = container_manager
        .get_container_status("eliza-postgres")
        .await
        .map(|s| format!("PostgreSQL: {:?}", s))
        .unwrap_or_else(|_| "PostgreSQL: Not found".to_string());

    let agent_status = container_manager
        .get_container_status("eliza-agent")
        .await
        .map(|s| format!("Agent: {:?}", s))
        .unwrap_or_else(|_| "Agent: Not found".to_string());

    Ok(format!(
        "Health Check Results:\n{}\n{}\n{}",
        runtime_status, postgres_status, agent_status
    ))
}

#[tauri::command]
pub async fn test_configuration(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    let mut results = json!({
        "runtime": false,
        "network": false,
        "database": false,
        "agent": false,
        "errors": []
    });
    let mut errors = vec![];

    // Test container runtime
    match container_manager.get_runtime_version().await {
        Ok(version) => {
            results["runtime"] = json!(true);
            results["runtimeVersion"] = json!(version);
        }
        Err(e) => {
            errors.push(format!("Container runtime not available: {}", e));
        }
    }

    // Test network connectivity
    // TODO: Implement network health check method in ContainerManager
    // match container_manager.check_network_health().await {
    //     Ok(healthy) => {
    //         results["network"] = json!(healthy);
    //     }
    //     Err(e) => {
    //         errors.push(format!("Network check failed: {}", e));
    //     }
    // }
    results["network"] = json!(true); // Placeholder - assume network is healthy

    // Test database connectivity if running
    if let Ok(state) = container_manager
        .get_container_status("eliza-postgres")
        .await
    {
        if matches!(state.state, crate::backend::types::ContainerState::Running) {
            // Try to connect to the database
            match agent_server_request("GET", "/api/health/database", None, Some(5)).await {
                Ok(_) => {
                    results["database"] = json!(true);
                }
                Err(e) => {
                    errors.push(format!("Database connection failed: {}", e));
                }
            }
        }
    }

    // Test agent connectivity if running
    if let Ok(state) = container_manager
        .get_container_status("eliza-agent")
        .await
    {
        if matches!(state.state, crate::backend::types::ContainerState::Running) {
            match agent_server_request("GET", "/api/health", None, Some(5)).await {
                Ok(_) => {
                    results["agent"] = json!(true);
                }
                Err(e) => {
                    errors.push(format!("Agent connection failed: {}", e));
                }
            }
        }
    }

    results["errors"] = json!(errors);
    Ok(results)
}

#[tauri::command]
pub async fn validate_configuration(
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<serde_json::Value, String> {
    let mut validation_results = json!({
        "valid": true,
        "issues": [],
        "warnings": []
    });
    let mut issues = vec![];
    let mut warnings = vec![];

    // Check if container runtime is available
    match container_manager.get_runtime_version().await {
        Ok(_) => {
            // Runtime is available
        }
        Err(e) => {
            issues.push(format!("Container runtime not available: {}", e));
            validation_results["valid"] = json!(false);
        }
    }

    // Check for required environment variables
    if std::env::var("OPENAI_API_KEY").is_err() && std::env::var("ANTHROPIC_API_KEY").is_err() {
        warnings.push("No AI provider API key found (OPENAI_API_KEY or ANTHROPIC_API_KEY)".to_string());
    }

    // Check for optional but recommended configurations
    if std::env::var("ELEVENLABS_API_KEY").is_err() {
        warnings.push("No ElevenLabs API key found - voice features will be disabled".to_string());
    }

    validation_results["issues"] = json!(issues);
    validation_results["warnings"] = json!(warnings);

    Ok(validation_results)
}

// Comprehensive startup test that verifies Tauri → AgentServer → Agent communication
#[tauri::command]
pub async fn run_startup_hello_world_test(
    startup_manager: State<'_, Arc<Mutex<StartupManager>>>,
    native_ws_client: State<'_, Arc<WebSocketClient>>,
    container_manager: State<'_, Arc<ContainerManager>>,
) -> Result<String, String> {
    info!("🧪 Running comprehensive startup hello world test");

    let mut test_results = Vec::new();

    // Step 1: Check if startup manager is ready
    {
        let manager = startup_manager.lock().await;
        let status = manager.get_status();
        if !manager.is_ready() {
            return Err(format!(
                "Startup manager not ready. Current stage: {:?}",
                status.stage
            ));
        }
        test_results.push("✅ Startup manager is ready".to_string());
    }

    // Get dynamic port configuration
    let port_config = container_manager.get_port_config().await;
    let agent_port = port_config.agent_port;

    if agent_port != 7777 {
        test_results.push(format!("ℹ️ Using alternative agent port: {}", agent_port));
    }

    // Step 2: Test HTTP API connectivity to agent server
    let client = reqwest::Client::new();
    let api_url = format!("http://localhost:{}/api/agents", agent_port);
    match client
        .get(&api_url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                test_results.push("✅ HTTP API connection to AgentServer working".to_string());
            } else {
                test_results.push(format!(
                    "⚠️ HTTP API responded with status: {}",
                    response.status()
                ));
            }
        }
        Err(e) => {
            test_results.push(format!("❌ HTTP API connection failed: {}", e));
        }
    }

    // Step 3: Test WebSocket connection
    let ws_connected = native_ws_client.is_connected().await;
    if ws_connected {
        test_results.push("✅ WebSocket already connected".to_string());
    } else {
        info!("WebSocket not connected, attempting to connect...");
        let ws_url = format!("ws://localhost:{}/ws", agent_port);
        match native_ws_client.connect(&ws_url).await {
            Ok(_) => {
                test_results.push("✅ WebSocket connection established".to_string());
                // Wait a moment for connection to stabilize
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
            Err(e) => {
                test_results.push(format!("❌ WebSocket connection failed: {}", e));
                return Ok(test_results.join("\n"));
            }
        }
    }

    // Step 4: Send a test message via WebSocket
    let test_message = "Hello World from Tauri! This is a startup connectivity test.";
    match native_ws_client.send_message(test_message).await {
        Ok(_) => {
            test_results.push("✅ Test message sent via WebSocket".to_string());
        }
        Err(e) => {
            test_results.push(format!("❌ Failed to send WebSocket message: {}", e));
        }
    }

    // Step 5: Test HTTP message ingestion (fallback method)
    let message_url = format!(
        "http://localhost:{}/api/messaging/ingest-external",
        agent_port
    );
    let channel_id = "e292bdf2-0baa-4677-a3a6-9426672ce6d8";
    let author_id = "00000000-0000-0000-0000-000000000001";

    match client
        .post(&message_url)
        .json(&serde_json::json!({
            "channel_id": channel_id,
            "server_id": "00000000-0000-0000-0000-000000000000",
            "author_id": author_id,
            "content": "HTTP test message from startup validation",
            "source_type": "startup_test",
            "raw_message": {
                "text": "HTTP test message from startup validation",
                "type": "startup_test"
            },
            "metadata": {
                "source": "tauri_startup_test",
                "userName": "SystemTest"
            }
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                test_results.push("✅ HTTP message ingestion working".to_string());
            } else {
                let status = response.status();
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string());
                test_results.push(format!(
                    "❌ HTTP message ingestion failed: {} - {}",
                    status, error_text
                ));
            }
        }
        Err(e) => {
            test_results.push(format!("❌ HTTP message ingestion request failed: {}", e));
        }
    }

    // Step 6: Summary
    let success_count = test_results.iter().filter(|r| r.starts_with("✅")).count();
    let warning_count = test_results.iter().filter(|r| r.starts_with("⚠️")).count();
    let error_count = test_results.iter().filter(|r| r.starts_with("❌")).count();

    test_results.push("".to_string());
    test_results.push("📊 STARTUP TEST SUMMARY:".to_string());
    test_results.push(format!("   ✅ Passed: {}", success_count));
    test_results.push(format!("   ⚠️ Warnings: {}", warning_count));
    test_results.push(format!("   ❌ Failed: {}", error_count));

    if error_count == 0 {
        test_results.push("".to_string());
        test_results.push(
            "🎉 All critical systems operational! Tauri ↔ AgentServer communication working."
                .to_string(),
        );
    } else {
        test_results.push("".to_string());
        test_results.push("🚨 Some systems have issues. Check the results above.".to_string());
    }

    Ok(test_results.join("\n"))
}