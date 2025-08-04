/**
 * Container Runtime Trait
 * Provides unified interface for Docker and Podman operations
 * Eliminates duplication between runtime implementations
 */
use crate::backend::{BackendResult, ContainerConfig, ContainerStatus};
use async_trait::async_trait;
use std::collections::HashMap;

/// Unified interface for container runtime operations
/// Implemented by both Docker and Podman clients
#[async_trait]
pub trait ContainerRuntime: Send + Sync {
    /// Check if the runtime is available and functional
    async fn is_available(&self) -> BackendResult<bool>;
    
    /// Get the runtime version
    async fn version(&self) -> BackendResult<String>;

    // Network operations
    async fn create_network(&self, network_name: &str) -> BackendResult<()>;
    async fn network_exists(&self, network_name: &str) -> BackendResult<bool>;
    async fn remove_network(&self, network_name: &str) -> BackendResult<()>;

    // Container lifecycle operations
    async fn create_container(
        &self,
        config: &ContainerConfig,
    ) -> BackendResult<String>; // Returns container ID

    async fn start_container(&self, container_id: &str) -> BackendResult<()>;
    async fn stop_container(&self, container_name: &str) -> BackendResult<()>;
    async fn remove_container(&self, container_name: &str) -> BackendResult<()>;
    async fn restart_container(&self, container_name: &str) -> BackendResult<()>;

    // Container inspection and status
    async fn container_exists(&self, container_name: &str) -> BackendResult<bool>;
    async fn get_container_status(&self, container_name: &str) -> BackendResult<ContainerStatus>;

    // Log operations
    async fn stream_container_logs(
        &self,
        container_name: &str,
        callback: Box<dyn Fn(String) + Send + Sync>,
    ) -> BackendResult<()>;
}

