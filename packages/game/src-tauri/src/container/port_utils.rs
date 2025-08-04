/**
 * Port detection utilities for container services
 * Eliminates duplicated port-checking logic across PostgreSQL, Ollama, and Agent services
 */
use tracing::info;

/// Configuration for port detection
#[derive(Debug, Clone)]
pub struct PortDetectionConfig {
    /// The service name for logging purposes
    pub service_name: String,
    /// The preferred default port
    pub default_port: u16,
    /// The fallback port to try if default is unavailable
    pub fallback_port: u16,
    /// The start of the port range to search if fallback fails
    pub range_start: u16,
    /// The end of the port range to search (exclusive)
    pub range_end: u16,
}

impl PortDetectionConfig {
    /// Create a new port detection configuration
    pub fn new(
        service_name: impl Into<String>,
        default_port: u16,
        fallback_port: u16,
        range_start: u16,
        range_end: u16,
    ) -> Self {
        Self {
            service_name: service_name.into(),
            default_port,
            fallback_port,
            range_start,
            range_end,
        }
    }

    /// PostgreSQL port detection configuration
    pub fn postgres() -> Self {
        Self::new("PostgreSQL", 5432, 5432, 5434, 5440)
    }

    /// Ollama port detection configuration  
    pub fn ollama() -> Self {
        Self::new("Ollama", 11434, 11435, 11436, 11440)
    }

    /// Agent port detection configuration
    pub fn agent() -> Self {
        Self::new("Agent", 7777, 7778, 7779, 7785)
    }
}

/// Result of port detection
#[derive(Debug, Clone)]
pub struct PortDetectionResult {
    /// The port that was found to be available
    pub port: u16,
}

/// Find an available port using the specified configuration
/// 
/// # Arguments
/// * `config` - The port detection configuration
/// * `current_port` - The currently configured port (may be different from default)
/// 
/// # Returns
/// A `PortDetectionResult` containing the available port and detection info
/// 
/// # Errors
/// Returns an error if no available port is found in the specified range
pub fn find_available_port(
    config: &PortDetectionConfig,
    current_port: u16,
) -> Result<PortDetectionResult, String> {
    // First, check if the current port is available
    if crate::common::is_port_available(current_port) {
        return Ok(PortDetectionResult {
            port: current_port,
        });
    }

    info!(
        "{} port {} is in use, trying alternative...",
        config.service_name, current_port
    );

    // Try the fallback port
    if crate::common::is_port_available(config.fallback_port) {
        info!(
            "{} using fallback port {}",
            config.service_name, config.fallback_port
        );
        return Ok(PortDetectionResult {
            port: config.fallback_port,
        });
    }

    // Try a range of ports
    for port in config.range_start..config.range_end {
        if crate::common::is_port_available(port) {
            info!(
                "{} using range port {} (from range {}-{})",
                config.service_name, port, config.range_start, config.range_end - 1
            );
            return Ok(PortDetectionResult {
                port,
            });
        }
    }

    Err(format!(
        "No available port found for {} in range {}-{} (tried default: {}, fallback: {})",
        config.service_name,
        config.range_start,
        config.range_end - 1,
        config.default_port,
        config.fallback_port
    ))
}

/// Find available ports for all standard services (PostgreSQL, Ollama, Agent)
/// 
/// # Arguments
/// * `postgres_port` - Current PostgreSQL port
/// * `ollama_port` - Current Ollama port  
/// * `agent_port` - Current Agent port
/// 
/// # Returns
/// A tuple of (postgres_port, ollama_port, agent_port) with available ports
/// 
/// # Errors
/// Returns an error if any service cannot find an available port
pub fn find_all_available_ports(
    postgres_port: u16,
    ollama_port: u16,
    agent_port: u16,
) -> Result<(u16, u16, u16), String> {
    let postgres_result = find_available_port(&PortDetectionConfig::postgres(), postgres_port)?;
    let ollama_result = find_available_port(&PortDetectionConfig::ollama(), ollama_port)?;
    let agent_result = find_available_port(&PortDetectionConfig::agent(), agent_port)?;

    info!(
        "Port allocation complete - PostgreSQL: {}, Ollama: {}, Agent: {}",
        postgres_result.port, ollama_result.port, agent_result.port
    );

    Ok((postgres_result.port, ollama_result.port, agent_result.port))
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_detection_config() {
        let postgres_config = PortDetectionConfig::postgres();
        assert_eq!(postgres_config.service_name, "PostgreSQL");
        assert_eq!(postgres_config.default_port, 5432);
        
        let ollama_config = PortDetectionConfig::ollama();
        assert_eq!(ollama_config.service_name, "Ollama");
        assert_eq!(ollama_config.default_port, 11434);
        
        let agent_config = PortDetectionConfig::agent();
        assert_eq!(agent_config.service_name, "Agent");
        assert_eq!(agent_config.default_port, 7777);
    }

    #[test]
    fn test_port_detection_result() {
        let result = PortDetectionResult {
            port: 5432,
            used_default: true,
            used_fallback: false,
        };
        
        assert_eq!(result.port, 5432);
        assert!(result.used_default);
        assert!(!result.used_fallback);
    }

    #[test] 
    fn test_find_first_available_in_range() {
        // This test might fail if ports in the range are actually in use
        let port = find_first_available_in_range(9000, 9010);
        // We can't assert a specific port since it depends on system state
        // but we can verify it returns a port in the expected range if found
        if let Some(port) = port {
            assert!(port >= 9000 && port < 9010);
        }
    }
}