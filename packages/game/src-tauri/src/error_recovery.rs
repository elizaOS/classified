/**
 * Centralized error recovery utilities for agent communication
 * Eliminates duplicated restart-and-retry logic across message handling functions
 */
use crate::container::ContainerManager;
use std::future::Future;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

/// Configuration for error recovery attempts
#[derive(Debug, Clone)]
pub struct RecoveryConfig {
    /// Time to wait after container restart before retrying
    pub recovery_delay: Duration,
    /// Maximum number of recovery attempts
    pub max_attempts: u32,
    /// Whether to log detailed recovery steps
    pub verbose_logging: bool,
}

impl Default for RecoveryConfig {
    fn default() -> Self {
        Self {
            recovery_delay: Duration::from_secs(5),
            max_attempts: 1,
            verbose_logging: true,
        }
    }
}

/// Result of an error recovery attempt
#[derive(Debug, Clone)]
pub struct RecoveryResult<T> {
    pub result: Result<T, String>,
    pub recovery_attempted: bool,
    pub recovery_succeeded: bool,
    pub attempts_made: u32,
}

/// Types of recoverable errors
#[derive(Debug, Clone, PartialEq)]
pub enum RecoverableError {
    ConnectionRefused,
    TcpConnectError,
    ConnectionClosed,
}

impl RecoverableError {
    /// Check if an error string represents a recoverable connection error
    pub fn from_error_string(error_str: &str) -> Option<Self> {
        let lower_error = error_str.to_lowercase();
        
        if lower_error.contains("connection refused") {
            Some(Self::ConnectionRefused)
        } else if lower_error.contains("tcp connect error") {
            Some(Self::TcpConnectError)
        } else if lower_error.contains("connection closed") {
            Some(Self::ConnectionClosed)
        } else {
            None
        }
    }
    
    /// Get a human-readable description of the error type
    pub fn description(&self) -> &'static str {
        match self {
            Self::ConnectionRefused => "Connection refused by server",
            Self::TcpConnectError => "TCP connection error",
            Self::ConnectionClosed => "Connection closed unexpectedly",
        }
    }
    
    /// Check if this error type is recoverable via container restart
    pub fn is_container_recoverable(&self) -> bool {
        matches!(
            self,
            Self::ConnectionRefused | Self::TcpConnectError | Self::ConnectionClosed
        )
    }
}

/// Execute an operation with automatic error recovery
/// 
/// This function attempts to execute the provided operation, and if it fails with a
/// recoverable error, attempts to restart the agent container and retry the operation.
/// 
/// # Arguments
/// * `operation` - The async operation to execute and potentially retry
/// * `container_manager` - Optional container manager for recovery attempts
/// * `config` - Configuration for recovery behavior
/// * `operation_name` - Human-readable name for logging purposes
/// 
/// # Returns
/// A `RecoveryResult` containing the final result and recovery metadata
/// 
/// # Example
/// ```rust
/// let result = execute_with_recovery(
///     || async { send_message_to_api(&message).await },
///     Some(container_manager.clone()),
///     RecoveryConfig::default(),
///     "send message"
/// ).await;
/// 
/// match result.result {
///     Ok(response) => println!("Success: {}", response),
///     Err(e) => println!("Failed after {} attempts: {}", result.attempts_made, e),
/// }
/// ```
pub async fn execute_with_recovery<F, Fut, T>(
    operation: F,
    container_manager: Option<Arc<ContainerManager>>,
    config: RecoveryConfig,
    operation_name: &str,
) -> RecoveryResult<T>
where
    F: Fn() -> Fut + Send + Sync,
    Fut: Future<Output = Result<T, Box<dyn std::error::Error + Send + Sync>>> + Send,
    T: Send,
{
    let mut attempts_made = 0;
    let mut recovery_attempted = false;
    let mut recovery_succeeded = false;

    // First attempt
    attempts_made += 1;
    if config.verbose_logging {
        info!("🔄 Attempting {}: attempt {}", operation_name, attempts_made);
    }

    match operation().await {
        Ok(result) => {
            if config.verbose_logging {
                info!("✅ {} succeeded on first attempt", operation_name);
            }
            RecoveryResult {
                result: Ok(result),
                recovery_attempted,
                recovery_succeeded,
                attempts_made,
            }
        }
        Err(e) => {
            let error_str = e.to_string();
            
            // Check if this is a recoverable error
            if let Some(recoverable_error) = RecoverableError::from_error_string(&error_str) {
                if config.verbose_logging {
                    warn!(
                        "⚠️  {} failed with recoverable error: {} ({})",
                        operation_name,
                        recoverable_error.description(),
                        error_str
                    );
                }

                // Attempt recovery if we have a container manager and haven't exceeded max attempts
                if let Some(manager) = container_manager {
                    if attempts_made < config.max_attempts + 1 && recoverable_error.is_container_recoverable() {
                        recovery_attempted = true;
                        
                        if config.verbose_logging {
                            warn!("🔧 Attempting container recovery for {}", operation_name);
                        }

                        // Try to restart the agent container
                        match manager.restart_container(crate::common::AGENT_CONTAINER).await {
                            Ok(_) => {
                                recovery_succeeded = true;
                                
                                if config.verbose_logging {
                                    info!(
                                        "✅ Agent container restarted for {}, waiting {}s before retry...",
                                        operation_name,
                                        config.recovery_delay.as_secs()
                                    );
                                }

                                // Wait for container to stabilize
                                tokio::time::sleep(config.recovery_delay).await;

                                // Retry the operation
                                attempts_made += 1;
                                if config.verbose_logging {
                                    info!("🔄 Retrying {} after recovery: attempt {}", operation_name, attempts_made);
                                }

                                match operation().await {
                                    Ok(result) => {
                                        if config.verbose_logging {
                                            info!("✅ {} succeeded after recovery", operation_name);
                                        }
                                        return RecoveryResult {
                                            result: Ok(result),
                                            recovery_attempted,
                                            recovery_succeeded,
                                            attempts_made,
                                        };
                                    }
                                    Err(retry_error) => {
                                        error!(
                                            "❌ {} still failed after recovery: {}",
                                            operation_name,
                                            retry_error
                                        );
                                        return RecoveryResult {
                                            result: Err(format!(
                                                "{} failed after recovery attempt: {}",
                                                operation_name, retry_error
                                            )),
                                            recovery_attempted,
                                            recovery_succeeded,
                                            attempts_made,
                                        };
                                    }
                                }
                            }
                            Err(recovery_error) => {
                                error!(
                                    "❌ Failed to restart agent container for {}: {}",
                                    operation_name, recovery_error
                                );
                                return RecoveryResult {
                                    result: Err(format!(
                                        "{} failed and recovery failed: {} (original: {})",
                                        operation_name, recovery_error, error_str
                                    )),
                                    recovery_attempted,
                                    recovery_succeeded: false,
                                    attempts_made,
                                };
                            }
                        }
                    }
                }

                // No recovery attempted or recovery not applicable
                RecoveryResult {
                    result: Err(format!("{} failed: {}", operation_name, error_str)),
                    recovery_attempted,
                    recovery_succeeded,
                    attempts_made,
                }
            } else {
                // Non-recoverable error
                if config.verbose_logging {
                    error!("❌ {} failed with non-recoverable error: {}", operation_name, error_str);
                }
                RecoveryResult {
                    result: Err(format!("{} failed: {}", operation_name, error_str)),
                    recovery_attempted,
                    recovery_succeeded,
                    attempts_made,
                }
            }
        }
    }
}

/// Convenience function for simple retry with default configuration
pub async fn retry_with_recovery<F, Fut, T>(
    operation: F,
    container_manager: Option<Arc<ContainerManager>>,
    operation_name: &str,
) -> Result<T, String>
where
    F: Fn() -> Fut + Send + Sync,
    Fut: Future<Output = Result<T, Box<dyn std::error::Error + Send + Sync>>> + Send,
    T: Send,
{
    let result = execute_with_recovery(
        operation,
        container_manager,
        RecoveryConfig::default(),
        operation_name,
    ).await;

    result.result
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recoverable_error_detection() {
        assert_eq!(
            RecoverableError::from_error_string("Connection refused"),
            Some(RecoverableError::ConnectionRefused)
        );
        
        assert_eq!(
            RecoverableError::from_error_string("tcp connect error occurred"),
            Some(RecoverableError::TcpConnectError)
        );
        
        assert_eq!(
            RecoverableError::from_error_string("connection closed by peer"),
            Some(RecoverableError::ConnectionClosed)
        );
        
        assert_eq!(
            RecoverableError::from_error_string("Not found"),
            None
        );
    }

    #[test]
    fn test_error_recoverability() {
        assert!(RecoverableError::ConnectionRefused.is_container_recoverable());
        assert!(RecoverableError::TcpConnectError.is_container_recoverable());
        assert!(RecoverableError::ConnectionClosed.is_container_recoverable());
    }

    #[test]
    fn test_recovery_config_defaults() {
        let config = RecoveryConfig::default();
        assert_eq!(config.recovery_delay, Duration::from_secs(5));
        assert_eq!(config.max_attempts, 1);
        assert!(config.verbose_logging);
    }

    #[tokio::test]
    async fn test_execute_with_recovery_success() {
        let operation = || async {
            Ok("success".to_string()) as Result<String, Box<dyn std::error::Error + Send + Sync>>
        };

        let result = execute_with_recovery(
            operation,
            None,
            RecoveryConfig::default(),
            "test operation"
        ).await;

        assert!(result.result.is_ok());
        assert_eq!(result.attempts_made, 1);
        assert!(!result.recovery_attempted);
    }

    #[tokio::test]
    async fn test_execute_with_recovery_non_recoverable_error() {
        let operation = || async {
            Err("Not found".into()) as Result<String, Box<dyn std::error::Error + Send + Sync>>
        };

        let result = execute_with_recovery(
            operation,
            None,
            RecoveryConfig::default(),
            "test operation"
        ).await;

        assert!(result.result.is_err());
        assert_eq!(result.attempts_made, 1);
        assert!(!result.recovery_attempted);
    }
}