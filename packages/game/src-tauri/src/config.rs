/**
 * Centralized configuration constants for the ElizaOS Game Tauri backend
 * These values can be overridden by environment variables
 */
use std::env;
use std::sync::OnceLock;

// Default values - must match frontend constants
const DEFAULT_AGENT_ID: &str = "2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f";
const DEFAULT_ROOM_ID: &str = "ce5f41b4-fe24-4c01-9971-aecfed20a6bd";
const DEFAULT_API_BASE_URL: &str = "http://localhost:7777";
const DEFAULT_WEBSOCKET_URL: &str = "ws://localhost:7777";

/// Application configuration structure
#[derive(Debug, Clone)]
pub struct Config {
    pub agent_id: String,
    pub room_id: String,
    pub api_base_url: String,
    pub websocket_url: String,
}

impl Config {
    /// Create a new configuration instance with environment variable overrides
    pub fn new() -> Self {
        Self {
            agent_id: env::var("ELIZA_AGENT_ID").unwrap_or_else(|_| DEFAULT_AGENT_ID.to_string()),
            room_id: env::var("ELIZA_ROOM_ID").unwrap_or_else(|_| DEFAULT_ROOM_ID.to_string()),
            api_base_url: env::var("ELIZA_API_BASE_URL").unwrap_or_else(|_| DEFAULT_API_BASE_URL.to_string()),
            websocket_url: env::var("ELIZA_WEBSOCKET_URL").unwrap_or_else(|_| DEFAULT_WEBSOCKET_URL.to_string()),
        }
    }

    /// Validate that all required configuration values are present and valid
    pub fn validate(&self) -> Result<(), String> {
        if self.agent_id.trim().is_empty() {
            return Err("Agent ID cannot be empty".to_string());
        }
        
        if self.room_id.trim().is_empty() {
            return Err("Room ID cannot be empty".to_string());
        }
        
        if self.api_base_url.trim().is_empty() {
            return Err("API base URL cannot be empty".to_string());
        }
        
        if self.websocket_url.trim().is_empty() {
            return Err("WebSocket URL cannot be empty".to_string());
        }
        
        Ok(())
    }

}

impl Default for Config {
    fn default() -> Self {
        Self::new()
    }
}

/// Global configuration instance
static CONFIG: OnceLock<Config> = OnceLock::new();

/// Get the global configuration instance  
pub fn get_config() -> &'static Config {
    if let Some(config) = CONFIG.get() {
        config
    } else {
        let config = Config::new();
        if let Err(e) = config.validate() {
            tracing::warn!("Configuration validation failed: {}", e);
        }
        CONFIG.set(config).unwrap_or(());
        CONFIG.get().unwrap()
    }
}

/// Get the agent ID from configuration
pub fn get_agent_id() -> &'static str {
    &get_config().agent_id
}

/// Get the room ID from configuration
pub fn get_room_id() -> &'static str {
    &get_config().room_id
}



#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_defaults() {
        let config = Config::new();
        assert_eq!(config.agent_id, DEFAULT_AGENT_ID);
        assert_eq!(config.room_id, DEFAULT_ROOM_ID);
        assert_eq!(config.api_base_url, DEFAULT_API_BASE_URL);
        assert_eq!(config.websocket_url, DEFAULT_WEBSOCKET_URL);
    }
    
    #[test]
    fn test_config_validation() {
        let config = Config::new();
        assert!(config.validate().is_ok());
        
        let invalid_config = Config {
            agent_id: "".to_string(),
            room_id: "valid".to_string(),
            api_base_url: "valid".to_string(),
            websocket_url: "valid".to_string(),
        };
        assert!(invalid_config.validate().is_err());
    }
    
    #[test]
    fn test_helper_functions() {
        let agent_id = get_agent_id();
        let room_id = get_room_id();
        let api_url = get_api_base_url();
        let ws_url = get_websocket_url();
        
        assert!(!agent_id.is_empty());
        assert!(!room_id.is_empty());
        assert!(!api_url.is_empty());
        assert!(!ws_url.is_empty());
    }
}