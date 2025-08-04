/**
 * Configuration management Tauri commands
 * Handles agent configuration, providers, validation, and settings
 */
use crate::common::agent_server_request;
use crate::config::get_agent_id;
use serde_json::Value;
use tracing::{error, info, warn};

/// Helper function to test OpenAI availability without making actual requests
async fn test_openai_availability() -> Result<bool, Box<dyn std::error::Error>> {
    // Check if OPENAI_API_KEY environment variable is set
    match std::env::var("OPENAI_API_KEY") {
        Ok(key) => Ok(!key.trim().is_empty()),
        Err(_) => Ok(false),
    }
}

/// Helper function to test Anthropic availability without making actual requests
async fn test_anthropic_availability() -> Result<bool, Box<dyn std::error::Error>> {
    // Check if ANTHROPIC_API_KEY environment variable is set
    match std::env::var("ANTHROPIC_API_KEY") {
        Ok(key) => Ok(!key.trim().is_empty()),
        Err(_) => Ok(false),
    }
}

/// Helper function to test Ollama availability
async fn test_ollama_availability() -> Result<bool, Box<dyn std::error::Error>> {
    let ollama_url = std::env::var("OLLAMA_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
    
    let client = reqwest::Client::new();
    match client
        .get(format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn get_agent_configuration() -> Result<Value, String> {
    info!("📋 Fetching agent configuration");
    
    let agent_id = get_agent_id();
    let endpoint = format!("/api/agents/{}/configuration", agent_id);
    
    match agent_server_request("GET", &endpoint, None, None).await {
        Ok(response) => Ok(response),
        Err(e) => {
            error!("Failed to fetch agent configuration: {}", e);
            Err(format!("Failed to fetch agent configuration: {}", e))
        }
    }
}

#[tauri::command]
pub async fn update_agent_configuration(config: Value) -> Result<Value, String> {
    info!("🔧 Updating agent configuration");
    
    // Try the agent-specific configuration endpoint first
    let agent_id = get_agent_id();
    let endpoint = format!("/api/agents/{}/configuration", agent_id);
    
    let first_result = agent_server_request("POST", &endpoint, Some(config.clone()), None).await;
    if let Ok(response) = first_result {
        info!("✅ Agent configuration updated successfully");
        return Ok(response);
    }
    
    // First attempt failed, prepare fallback
    let primary_error = first_result.unwrap_err().to_string();
    error!("Agent-specific config endpoint failed: {}", primary_error);
    
    // Fallback to general configuration endpoint
    match agent_server_request("POST", "/api/config/update", Some(config), None).await {
        Ok(response) => {
            info!("✅ Agent configuration updated via fallback endpoint");
            Ok(response)
        }
        Err(fallback_error) => {
            error!("Configuration update failed on both endpoints: {}", fallback_error);
            Err(format!(
                "Failed to update agent configuration. Primary error: {}, Fallback error: {}",
                primary_error, fallback_error
            ))
        }
    }
}

#[tauri::command]
pub async fn get_available_providers() -> Result<Value, String> {
    info!("🔍 Fetching available providers");
    
    // Try to get providers from the agent server first
    let providers_result = agent_server_request("GET", "/api/providers", None, None).await;
    if let Ok(response) = providers_result {
        info!("✅ Retrieved providers from agent server");
        return Ok(response);
    }
    
    // Agent server failed, use fallback
    let error_msg = providers_result.unwrap_err().to_string();
    warn!("Failed to fetch providers from agent server: {}", error_msg);
    
    // Fallback to static provider configuration with dynamic status checking
    info!("🔄 Using fallback provider configuration with status checks");
    
    let mut providers = Vec::new();
    
    // Check OpenAI availability
    let openai_status = match test_openai_availability().await {
        Ok(available) => if available { "available" } else { "configuration_required" },
        Err(_) => "unavailable"
    };
    
    providers.push(serde_json::json!({
        "id": "openai",
        "name": "OpenAI",
        "type": "llm",
        "status": openai_status,
        "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        "description": "OpenAI's GPT models for text generation and chat",
        "configuration_required": openai_status == "configuration_required"
    }));
    
    // Check Anthropic availability
    let anthropic_status = match test_anthropic_availability().await {
        Ok(available) => if available { "available" } else { "configuration_required" },
        Err(_) => "unavailable"
    };
    
    providers.push(serde_json::json!({
        "id": "anthropic",
        "name": "Anthropic",
        "type": "llm",
        "status": anthropic_status,
        "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
        "description": "Anthropic's Claude models for conversational AI",
        "configuration_required": anthropic_status == "configuration_required"
    }));
    
    // Check Ollama availability
    let ollama_status = match test_ollama_availability().await {
        Ok(available) => if available { "available" } else { "configuration_required" },
        Err(_) => "unavailable"
    };
    
    providers.push(serde_json::json!({
        "id": "ollama",
        "name": "Ollama",
        "type": "llm",
        "status": ollama_status,
        "models": ["llama3.2:3b", "llama3.2:1b", "codellama", "mistral", "qwen2.5:coder"],
        "description": "Local models via Ollama for privacy-focused AI",
        "configuration_required": ollama_status == "configuration_required"
    }));
    
    // Add additional providers
    providers.push(serde_json::json!({
        "id": "groq",
        "name": "Groq",
        "type": "llm",
        "status": "configuration_required",
        "models": ["llama-3.1-405b", "llama-3.1-70b", "llama-3.1-8b"],
        "description": "High-speed inference with Groq's LPU technology",
        "configuration_required": true
    }));
    
    providers.push(serde_json::json!({
        "id": "elizaos",
        "name": "ElizaOS Services",
        "type": "llm",
        "status": "configuration_required",
        "models": ["elizaos-default"],
        "description": "ElizaOS managed language model services",
        "configuration_required": true
    }));
    
    Ok(serde_json::json!({
        "success": true,
        "data": {
            "providers": providers,
            "source": "fallback_with_status_check",
            "timestamp": chrono::Utc::now().to_rfc3339()
        },
        "message": "Provider data retrieved from fallback configuration with live status checks"
    }))
}

#[tauri::command]
pub async fn validate_agent_config(config: Value) -> Result<Value, String> {
    info!("✅ Validating configuration");
    
    // Try server-side validation first
    match agent_server_request("POST", "/api/config/validate", Some(config.clone()), None).await {
        Ok(response) => {
            info!("✅ Configuration validated by server");
            Ok(response)
        }
        Err(e) => {
            warn!("Server validation failed, using client-side validation: {}", e);
            
            // Fallback to client-side validation
            let mut errors = Vec::new();
            let mut warnings = Vec::new();
            
            // Check for required fields
            if config.get("MODEL_PROVIDER").is_none() {
                errors.push("MODEL_PROVIDER is required".to_string());
            }
            
            // Check API keys based on provider
            if let Some(provider) = config.get("MODEL_PROVIDER").and_then(|p| p.as_str()) {
                match provider {
                    "openai" => {
                        if config.get("OPENAI_API_KEY").is_none() {
                            errors.push("OPENAI_API_KEY is required for OpenAI provider".to_string());
                        }
                    }
                    "anthropic" => {
                        if config.get("ANTHROPIC_API_KEY").is_none() {
                            errors.push("ANTHROPIC_API_KEY is required for Anthropic provider".to_string());
                        }
                    }
                    "ollama" => {
                        if config.get("OLLAMA_SERVER_URL").is_none() {
                            warnings.push("OLLAMA_SERVER_URL not specified, using default".to_string());
                        }
                    }
                    "groq" => {
                        if config.get("GROQ_API_KEY").is_none() {
                            errors.push("GROQ_API_KEY is required for Groq provider".to_string());
                        }
                    }
                    "elizaos" => {
                        if config.get("ELIZAOS_API_KEY").is_none() {
                            errors.push("ELIZAOS_API_KEY is required for ElizaOS provider".to_string());
                        }
                    }
                    _ => {
                        warnings.push(format!("Unknown provider: {}", provider));
                    }
                }
            }
            
            // Check model configuration
            if config.get("LANGUAGE_MODEL").is_none() {
                warnings.push("LANGUAGE_MODEL not specified, using provider default".to_string());
            }
            
            let is_valid = errors.is_empty();
            
            Ok(serde_json::json!({
                "success": true,
                "data": {
                    "valid": is_valid,
                    "errors": errors,
                    "warnings": warnings,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "source": "client_validation"
                }
            }))
        }
    }
}

#[tauri::command]
pub async fn test_agent_config(config: Value) -> Result<Value, String> {
    info!("🧪 Testing configuration");
    
    // Try server-side testing first
    let server_test_result = agent_server_request("POST", "/api/config/test", Some(config.clone()), Some(30)).await;
    if let Ok(response) = server_test_result {
        info!("✅ Configuration tested by server");
        return Ok(response);
    }
    
    // Server testing failed, use client-side fallback
    let error_msg = server_test_result.unwrap_err().to_string();
    warn!("Server testing failed, using client-side testing: {}", error_msg);
    
    // Fallback to client-side testing
    let provider = config.get("MODEL_PROVIDER")
        .and_then(|p| p.as_str())
        .unwrap_or("unknown");
    
    match provider {
        "openai" => test_openai_configuration(&config).await,
        "anthropic" => test_anthropic_configuration(&config).await,  
        "ollama" => test_ollama_configuration(&config).await,
        "groq" => test_groq_configuration(&config).await,
        "elizaos" => test_elizaos_configuration(&config).await,
        _ => Ok(serde_json::json!({
            "success": false,
            "error": format!("Testing not supported for provider: {}", provider),
            "data": {
                "provider": provider,
                "source": "client_testing"
            }
        }))
    }
}

async fn test_openai_configuration(config: &Value) -> Result<Value, String> {
    let api_key = config.get("OPENAI_API_KEY")
        .and_then(|k| k.as_str())
        .ok_or("OPENAI_API_KEY not found")?;
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status().is_success() => {
            Ok(serde_json::json!({
                "success": true,
                "message": "OpenAI API connection successful",
                "data": {
                    "provider": "openai",
                    "status": "connected",
                    "source": "client_testing"
                }
            }))
        }
        Ok(resp) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("OpenAI API returned status: {}", resp.status()),
                "data": {
                    "provider": "openai",
                    "status": "error",
                    "source": "client_testing"
                }
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Failed to connect to OpenAI API: {}", e),
                "data": {
                    "provider": "openai", 
                    "status": "connection_failed",
                    "source": "client_testing"
                }
            }))
        }
    }
}

async fn test_anthropic_configuration(config: &Value) -> Result<Value, String> {
    let api_key = config.get("ANTHROPIC_API_KEY")
        .and_then(|k| k.as_str())
        .ok_or("ANTHROPIC_API_KEY not found")?;
    
    // Anthropic doesn't have a simple models endpoint, so we'll do a basic auth test
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "test"}]
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status() == 200 || resp.status() == 400 => {
            // 400 is also OK - it means auth worked but request was invalid
            Ok(serde_json::json!({
                "success": true,
                "message": "Anthropic API connection successful",
                "data": {
                    "provider": "anthropic",
                    "status": "connected",
                    "source": "client_testing"
                }
            }))
        }
        Ok(resp) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Anthropic API returned status: {}", resp.status()),
                "data": {
                    "provider": "anthropic",
                    "status": "error",
                    "source": "client_testing"
                }
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Failed to connect to Anthropic API: {}", e),
                "data": {
                    "provider": "anthropic",
                    "status": "connection_failed",
                    "source": "client_testing"
                }
            }))
        }
    }
}

async fn test_ollama_configuration(config: &Value) -> Result<Value, String> {
    let server_url = config.get("OLLAMA_SERVER_URL")
        .and_then(|u| u.as_str())
        .unwrap_or("http://localhost:11434");
    
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/tags", server_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status().is_success() => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Ollama server connection successful",
                "data": {
                    "provider": "ollama",
                    "status": "connected",
                    "server_url": server_url,
                    "source": "client_testing"
                }
            }))
        }
        Ok(resp) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Ollama server returned status: {}", resp.status()),
                "data": {
                    "provider": "ollama",
                    "status": "error",
                    "server_url": server_url,
                    "source": "client_testing"
                }
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Failed to connect to Ollama server: {}", e),
                "data": {
                    "provider": "ollama",
                    "status": "connection_failed", 
                    "server_url": server_url,
                    "source": "client_testing"
                }
            }))
        }
    }
}

async fn test_groq_configuration(config: &Value) -> Result<Value, String> {
    let api_key = config.get("GROQ_API_KEY")
        .and_then(|k| k.as_str())
        .ok_or("GROQ_API_KEY not found")?;
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.groq.com/openai/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status().is_success() => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Groq API connection successful",
                "data": {
                    "provider": "groq",
                    "status": "connected",
                    "source": "client_testing"
                }
            }))
        }
        Ok(resp) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Groq API returned status: {}", resp.status()),
                "data": {
                    "provider": "groq",
                    "status": "error",
                    "source": "client_testing"
                }
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Failed to connect to Groq API: {}", e),
                "data": {
                    "provider": "groq",
                    "status": "connection_failed",
                    "source": "client_testing"
                }
            }))
        }
    }
}

async fn test_elizaos_configuration(config: &Value) -> Result<Value, String> {
    let api_key = config.get("ELIZAOS_API_KEY")
        .and_then(|k| k.as_str())
        .ok_or("ELIZAOS_API_KEY not found")?;
    
    // For ElizaOS services, test against the configured endpoint
    let base_url = config.get("ELIZAOS_API_URL")
        .and_then(|u| u.as_str())
        .unwrap_or("https://api.elizaos.com");
    
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/health", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status().is_success() => {
            Ok(serde_json::json!({
                "success": true,
                "message": "ElizaOS API connection successful",
                "data": {
                    "provider": "elizaos",
                    "status": "connected",
                    "api_url": base_url,
                    "source": "client_testing"
                }
            }))
        }
        Ok(resp) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("ElizaOS API returned status: {}", resp.status()),
                "data": {
                    "provider": "elizaos",
                    "status": "error",
                    "api_url": base_url,
                    "source": "client_testing"
                }
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": format!("Failed to connect to ElizaOS API: {}", e),
                "data": {
                    "provider": "elizaos",
                    "status": "connection_failed",
                    "api_url": base_url,
                    "source": "client_testing"
                }
            }))
        }
    }
}