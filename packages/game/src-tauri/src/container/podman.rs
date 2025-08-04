use crate::backend::{BackendError, BackendResult, ContainerConfig, ContainerStatus, ContainerState, HealthStatus};
use crate::container::runtime_trait::ContainerRuntime;
use async_trait::async_trait;

use std::path::Path;
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use tracing::{error, info, warn};

// Helper function to parse Podman uptime strings
fn parse_podman_uptime(status: &str) -> u64 {
    // Status examples: "Up 2 hours ago", "Up 3 minutes ago", "Exited (0) 3 hours ago"
    if !status.contains("Up") {
        return 0;
    }
    
    let parts: Vec<&str> = status.split_whitespace().collect();
    if parts.len() < 3 {
        return 0;
    }
    
    let number = parts[1].parse::<u64>().unwrap_or(0);
    let unit = parts[2];
    
    match unit {
        s if s.starts_with("second") => number,
        s if s.starts_with("minute") => number * 60,
        s if s.starts_with("hour") => number * 3600,
        s if s.starts_with("day") => number * 86400,
        _ => 0,
    }
}

#[derive(Clone)]
pub struct PodmanClient {
    podman_path: String,
}

impl Default for PodmanClient {
    fn default() -> Self {
        Self::new()
    }
}

impl PodmanClient {
    pub fn new() -> Self {
        Self {
            podman_path: "podman".to_string(),
        }
    }

    pub fn with_path(path: String) -> Self {
        Self { podman_path: path }
    }

    pub fn get_path(&self) -> &str {
        &self.podman_path
    }

    pub async fn create_network(&self, network_name: &str) -> BackendResult<()> {
        info!("Creating container network: {}", network_name);

        // Check if network already exists
        let check_output = Command::new(&self.podman_path)
            .args(["network", "ls", "--format", "{{.Name}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list networks: {e}")))?;

        let networks = String::from_utf8_lossy(&check_output.stdout);
        if networks.lines().any(|n| n.trim() == network_name) {
            info!("Network {} already exists", network_name);
            return Ok(());
        }

        // Create the network
        let output = Command::new(&self.podman_path)
            .args(["network", "create", network_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to create network: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to create network {network_name}: {error_msg}"
            )));
        }

        info!("Network {} created successfully", network_name);
        Ok(())
    }

    pub async fn is_available(&self) -> BackendResult<bool> {
        match Command::new(&self.podman_path).arg("--version").output() {
            Ok(output) => {
                let version_str = String::from_utf8_lossy(&output.stdout);
                info!("Podman available: {}", version_str.trim());
                Ok(output.status.success())
            }
            Err(e) => {
                error!("Podman not available: {}", e);
                Ok(false)
            }
        }
    }

    pub async fn start_container(&self, config: &ContainerConfig) -> BackendResult<String> {
        info!("Starting container: {}", config.name);

        // Build podman run command
        let mut cmd = Command::new(&self.podman_path);
        cmd.args(["run", "-d", "--name", &config.name]);

        // Add container to network for inter-container communication
        if let Some(network) = &config.network {
            cmd.args(["--network", network]);
        }

        // Add port mappings
        for port in &config.ports {
            cmd.args(["-p", &format!("{}:{}", port.host_port, port.container_port)]);
        }

        // Add environment variables
        for env in &config.environment {
            cmd.args(["-e", env]);
        }

        // Add volume mounts
        for volume in &config.volumes {
            cmd.args([
                "-v",
                &format!("{}:{}", volume.host_path, volume.container_path),
            ]);
        }

        // Add memory limit if specified
        if let Some(memory_limit) = &config.memory_limit {
            cmd.args(["-m", memory_limit]);
        }

        // Add image
        cmd.arg(&config.image);

        // Execute command
        let output = cmd
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to start container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to start container {}: {}",
                config.name, error_msg
            )));
        }

        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        info!(
            "Container {} started with ID: {}",
            config.name, container_id
        );

        Ok(container_id)
    }

    pub async fn stop_container(&self, name: &str) -> BackendResult<()> {
        info!("Stopping container: {}", name);

        let output = Command::new(&self.podman_path)
            .args(["stop", name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to stop container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            warn!("Failed to stop container {}: {}", name, error_msg);
        }

        info!("Container {} stopped", name);
        Ok(())
    }

    pub async fn remove_container(&self, name: &str) -> BackendResult<()> {
        info!("Removing container: {}", name);

        let output = Command::new(&self.podman_path)
            .args(["rm", "-f", name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to remove container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            warn!("Failed to remove container {}: {}", name, error_msg);
        }

        info!("Container {} removed", name);
        Ok(())
    }

    pub async fn load_image(&self, image_path: &Path) -> BackendResult<()> {
        info!("Loading image from: {:?}", image_path);

        let output = Command::new(&self.podman_path)
            .args(["load", "-i"])
            .arg(image_path)
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to load image: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to load image: {error_msg}"
            )));
        }

        info!("Image loaded successfully from: {:?}", image_path);
        Ok(())
    }

    pub async fn image_exists(&self, image_name: &str) -> BackendResult<bool> {
        let output = Command::new(&self.podman_path)
            .args(["images", "--format", "{{.Repository}}:{{.Tag}}", image_name])
            .output()
            .map_err(|e| {
                BackendError::Container(format!("Failed to check image existence: {e}"))
            })?;

        if !output.status.success() {
            return Ok(false);
        }

        let images_list = String::from_utf8_lossy(&output.stdout);
        Ok(!images_list.trim().is_empty())
    }

    pub async fn start_existing_container(&self, container_name: &str) -> BackendResult<()> {
        info!("Starting existing container: {}", container_name);

        let output = Command::new(&self.podman_path)
            .args(["start", container_name])
            .output()
            .map_err(|e| {
                BackendError::Container(format!("Failed to start existing container: {e}"))
            })?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to start existing container {container_name}: {error_msg}"
            )));
        }

        info!(
            "Successfully started existing container: {}",
            container_name
        );
        Ok(())
    }

    pub async fn get_container_status_impl(
        &self,
        container_name: &str,
    ) -> BackendResult<crate::backend::ContainerStatus> {
        info!("Getting status for container: {}", container_name);

        // First check if container exists
        let output = Command::new(&self.podman_path)
            .args([
                "ps",
                "-a",
                "--format",
                "{{.ID}}:{{.Names}}:{{.Image}}:{{.State}}:{{.Status}}:{{.CreatedAt}}",
                "--filter",
                &format!("name={}", container_name),
            ])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to get container status: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to get container status: {error_msg}"
            )));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = output_str.trim().lines().collect();

        if lines.is_empty() {
            return Err(BackendError::Container(format!(
                "Container {container_name} not found"
            )));
        }

        // Parse the first matching container
        if let Some(line) = lines.first() {
            info!("Parsing container status line for {}: {}", container_name, line);
            let parts: Vec<&str> = line.split(':').collect();
            info!("Parts count: {}, parts: {:?}", parts.len(), parts);
            if parts.len() >= 6 {
                // The image name can contain colons (e.g., docker.io/pgvector/pgvector:pg16)
                // So we need to find the state field by looking for known state values
                let mut state_index = None;
                for (i, part) in parts.iter().enumerate() {
                    match *part {
                        "running" | "paused" | "exited" | "stopped" | "created" => {
                            state_index = Some(i);
                            break;
                        }
                        _ => continue,
                    }
                }
                
                let state = if let Some(idx) = state_index {
                    info!("State field (parts[{}]): '{}'", idx, parts[idx]);
                    match parts[idx] {
                        "running" => crate::backend::ContainerState::Running,
                        "paused" => crate::backend::ContainerState::Stopped,
                        "exited" | "stopped" => crate::backend::ContainerState::Stopped,
                        "created" => crate::backend::ContainerState::Starting,
                        _ => {
                            warn!("Unknown state '{}' for container {}", parts[idx], container_name);
                            crate::backend::ContainerState::Unknown
                        },
                    }
                } else {
                    warn!("Could not find state field in parts: {:?}", parts);
                    crate::backend::ContainerState::Unknown
                };
                
                // Parse uptime from status field (should be right after the state)
                let uptime_seconds = if let Some(idx) = state_index {
                    if idx + 1 < parts.len() {
                        parse_podman_uptime(parts[idx + 1])
                    } else {
                        0
                    }
                } else {
                    0
                };

                // Get actual health status from inspect if container is running
                let health = if state == crate::backend::ContainerState::Running {
                    info!("Container {} is running, checking health status", container_name);
                    match self.get_container_health_status(container_name).await {
                        Ok(health_status) => {
                            info!("Health check returned {:?} for container {}", health_status, container_name);
                            health_status
                        },
                        Err(e) => {
                            warn!("Health check failed for container {}: {}", container_name, e);
                            crate::backend::HealthStatus::Unknown
                        }
                    }
                } else {
                    info!("Container {} is not running (state: {:?}), setting health to Unknown", container_name, state);
                    crate::backend::HealthStatus::Unknown
                };

                return Ok(crate::backend::ContainerStatus {
                    id: parts[0].to_string(),
                    name: parts[1].to_string(),
                    image: parts[2].to_string(),
                    state,
                    health,
                    ports: vec![],
                    started_at: None, // Podman timestamp parsing would go here
                    uptime_seconds,
                    restart_count: 0, // Podman doesn't provide this in ps output
                });
            }
        }

        Err(BackendError::Container(
            "Failed to parse container status".to_string(),
        ))
    }

    async fn get_container_health_status(&self, container_name: &str) -> BackendResult<crate::backend::HealthStatus> {
        info!("Checking health status for container: {}", container_name);
        
        // Use inspect to get detailed health information
        let output = AsyncCommand::new(&self.podman_path)
            .args([
                "inspect",
                "--format",
                "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
                container_name,
            ])
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to inspect container health: {e}")))?;

        if !output.status.success() {
            warn!("Failed to inspect health for container {}", container_name);
            return Ok(crate::backend::HealthStatus::Unknown);
        }

        let health_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        info!("Container {} health status from inspect: '{}'", container_name, health_str);
        
        match health_str.as_str() {
            "healthy" => Ok(crate::backend::HealthStatus::Healthy),
            "unhealthy" => Ok(crate::backend::HealthStatus::Unhealthy),
            "starting" => Ok(crate::backend::HealthStatus::Starting),
            "none" => {
                // No health check defined, check if PostgreSQL is actually ready
                if container_name.contains("postgres") {
                    info!("Container {} has no health check, checking PostgreSQL readiness", container_name);
                    // For PostgreSQL, run pg_isready to check if it's actually ready
                    match self.check_postgres_ready(container_name).await {
                        Ok(true) => {
                            info!("PostgreSQL is ready for container {}", container_name);
                            Ok(crate::backend::HealthStatus::Healthy)
                        },
                        Ok(false) => {
                            info!("PostgreSQL is not ready yet for container {}", container_name);
                            Ok(crate::backend::HealthStatus::Starting)
                        },
                        Err(e) => {
                            warn!("Error checking PostgreSQL readiness for {}: {}", container_name, e);
                            Ok(crate::backend::HealthStatus::Unknown)
                        },
                    }
                } else {
                    // For other containers without health check, assume healthy if running
                    Ok(crate::backend::HealthStatus::Healthy)
                }
            }
            _ => {
                warn!("Unknown health status '{}' for container {}", health_str, container_name);
                Ok(crate::backend::HealthStatus::Unknown)
            }
        }
    }

    async fn check_postgres_ready(&self, container_name: &str) -> BackendResult<bool> {
        // Run pg_isready inside the container to check if PostgreSQL is ready
        // Don't specify user/database to avoid auth issues - just check if server is accepting connections
        let output = AsyncCommand::new(&self.podman_path)
            .args([
                "exec",
                container_name,
                "pg_isready",
                "-h",
                "localhost",
                "-p",
                "5432",
            ])
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to check PostgreSQL readiness: {e}")))?;

        // Log the result for debugging
        let is_ready = output.status.success();
        if !is_ready {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            info!("PostgreSQL not ready yet for {}: stderr={}, stdout={}", container_name, stderr, stdout);
        } else {
            info!("PostgreSQL is ready for container {} via pg_isready", container_name);
        }
        
        Ok(is_ready)
    }

    pub async fn list_containers_by_pattern(&self, pattern: &str) -> BackendResult<Vec<String>> {
        info!("Listing containers matching pattern: {}", pattern);

        let output = Command::new(&self.podman_path)
            .args([
                "ps",
                "-a",
                "--format",
                "{{.Names}}",
                "--filter",
                &format!("name={}", pattern),
            ])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list containers: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to list containers: {error_msg}"
            )));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        let names: Vec<String> = output_str
            .lines()
            .filter(|line| !line.is_empty())
            .map(|s| s.to_string())
            .collect();

        Ok(names)
    }

    /// Execute a command inside a running container
    #[allow(dead_code)]
    pub async fn exec(
        &self,
        container_name: &str,
        command: &[&str],
    ) -> BackendResult<std::process::Output> {
        info!(
            "Executing command in container {}: {:?}",
            container_name, command
        );

        let mut args = vec!["exec", container_name];
        args.extend(command);

        let output = tokio::process::Command::new(&self.podman_path)
            .args(&args)
            .output()
            .await
            .map_err(|e| {
                BackendError::Container(format!(
                    "Failed to exec in container {}: {}",
                    container_name, e
                ))
            })?;

        Ok(output)
    }

    pub async fn container_exists(&self, container_name: &str) -> BackendResult<bool> {
        match Command::new(&self.podman_path)
            .args(["container", "exists", container_name])
            .output()
        {
            Ok(output) => Ok(output.status.success()),
            Err(e) => Err(BackendError::Container(format!(
                "Failed to check if container exists: {}",
                e
            ))),
        }
    }

    pub async fn is_container_running(&self, container_name: &str) -> BackendResult<bool> {
        match Command::new(&self.podman_path)
            .args(["ps", "-q", "-f", &format!("name={}", container_name)])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    let container_list = String::from_utf8_lossy(&output.stdout);
                    Ok(!container_list.trim().is_empty())
                } else {
                    Ok(false)
                }
            }
            Err(e) => Err(BackendError::Container(format!(
                "Failed to check if container is running: {}",
                e
            ))),
        }
    }
}

// Implement the unified ContainerRuntime trait
#[async_trait]
impl ContainerRuntime for PodmanClient {
    async fn is_available(&self) -> BackendResult<bool> {
        self.is_available().await
    }



    async fn create_network(&self, network_name: &str) -> BackendResult<()> {
        self.create_network(network_name).await
    }

    async fn network_exists(&self, network_name: &str) -> BackendResult<bool> {
        let output = Command::new(&self.podman_path)
            .args(["network", "ls", "--format", "{{.Name}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list networks: {e}")))?;

        let networks = String::from_utf8_lossy(&output.stdout);
        Ok(networks.lines().any(|n| n.trim() == network_name))
    }

    async fn remove_network(&self, network_name: &str) -> BackendResult<()> {
        let output = Command::new(&self.podman_path)
            .args(["network", "rm", network_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to remove network: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to remove network {}: {}",
                network_name, error_msg
            )));
        }

        Ok(())
    }

    async fn create_container(&self, config: &ContainerConfig) -> BackendResult<String> {
        self.start_container(config).await
    }

    async fn start_container(&self, _container_id: &str) -> BackendResult<()> {
        // For Podman, start_container does both create and start
        // This is a no-op since we don't separate create and start in our impl
        Ok(())
    }

    async fn stop_container(&self, container_name: &str) -> BackendResult<()> {
        self.stop_container(container_name).await
    }

    async fn remove_container(&self, container_name: &str) -> BackendResult<()> {
        self.remove_container(container_name).await
    }

    async fn restart_container(&self, container_name: &str) -> BackendResult<()> {
        let output = Command::new(&self.podman_path)
            .args(["restart", container_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to restart container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to restart container {}: {}",
                container_name, error_msg
            )));
        }

        Ok(())
    }

    async fn container_exists(&self, container_name: &str) -> BackendResult<bool> {
        let output = Command::new(&self.podman_path)
            .args(["ps", "-a", "--format", "{{.Names}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list containers: {e}")))?;

        let containers = String::from_utf8_lossy(&output.stdout);
        Ok(containers.lines().any(|name| name.trim() == container_name))
    }

    async fn get_container_status(&self, container_name: &str) -> BackendResult<ContainerStatus> {
        // First, try our detailed ps-based method
        match self.get_container_status_impl(container_name).await {
            Ok(status) => Ok(status),
            Err(_) => {
                // Fallback to inspect for more details
                let output = Command::new(&self.podman_path)
                    .args([
                        "inspect",
                        "--format",
                        "{{.State.Status}}\t{{.Config.Image}}\t{{.Id}}\t{{.State.StartedAt}}\t{{.RestartCount}}",
                        container_name
                    ])
                    .output()
                    .map_err(|e| BackendError::Container(format!("Failed to inspect container: {e}")))?;

                if !output.status.success() {
                    return Err(BackendError::Container(format!(
                        "Container {} not found",
                        container_name
                    )));
                }

                let output_str = String::from_utf8_lossy(&output.stdout);
                let parts: Vec<&str> = output_str.trim().split('\t').collect();
                
                if parts.len() >= 5 {
                    let state = match parts[0] {
                        "running" => ContainerState::Running,
                        "exited" => ContainerState::Exited,
                        "paused" => ContainerState::Paused,
                        "restarting" => ContainerState::Restarting,
                        _ => ContainerState::Unknown,
                    };
                    
                    // Parse restart count
                    let restart_count = parts[4].parse::<u32>().unwrap_or(0);

                    // Get actual health status if container is running
                    let health = if state == ContainerState::Running {
                        info!("Container {} is running (fallback method), checking health status", container_name);
                        match self.get_container_health_status(container_name).await {
                            Ok(health_status) => {
                                info!("Health check returned {:?} for container {} (fallback)", health_status, container_name);
                                health_status
                            },
                            Err(e) => {
                                warn!("Health check failed for container {} (fallback): {}", container_name, e);
                                HealthStatus::Unknown
                            }
                        }
                    } else {
                        info!("Container {} is not running (state: {:?}, fallback), setting health to Unknown", container_name, state);
                        HealthStatus::Unknown
                    };

                    Ok(ContainerStatus {
                        id: parts[2].to_string(),
                        name: container_name.to_string(),
                        image: parts[1].to_string(),
                        state,
                        health,
                        ports: Vec::new(),
                        started_at: None, // Would parse parts[3] timestamp here
                        uptime_seconds: 0, // Would calculate from started_at
                        restart_count,
                    })
                } else {
                    Err(BackendError::Container(format!(
                        "Invalid inspect output for {}",
                        container_name
                    )))
                }
            }
        }
    }



    async fn stream_container_logs(
        &self,
        container_name: &str,
        callback: Box<dyn Fn(String) + Send + Sync>,
    ) -> BackendResult<()> {
        use tokio::io::{AsyncBufReadExt, BufReader};
        use tokio::process::Command as AsyncCommand;

        let mut child = AsyncCommand::new(&self.podman_path)
            .args(["logs", "-f", container_name])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| BackendError::Container(format!("Failed to start log stream: {e}")))?;

        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                callback(line);
            }
        }

        Ok(())
    }



    async fn version(&self) -> BackendResult<String> {
        let output = std::process::Command::new(&self.podman_path)
            .args(["version", "--format", "json"])
            .output()
            .map_err(|e| BackendError::Container(format!("Podman version command failed: {}", e)))?;

        if !output.status.success() {
            return Err(BackendError::Container(format!(
                "Podman version command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        let version_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&version_str) {
            if let Some(version) = json.get("Client")
                .and_then(|c| c.get("Version"))
                .and_then(|v| v.as_str()) 
            {
                return Ok(version.to_string());
            }
        }

        // Fallback to simple version output
        let output = std::process::Command::new(&self.podman_path)
            .args(["--version"])
            .output()
            .map_err(|e| BackendError::Container(format!("Podman version command failed: {}", e)))?;

        if output.status.success() {
            let version_line = String::from_utf8_lossy(&output.stdout);
            // Parse "podman version 4.8.3" -> "4.8.3"
            if let Some(version) = version_line
                .split_whitespace()
                .nth(2)
            {
                Ok(version.to_string())
            } else {
                Ok(version_line.trim().to_string())
            }
        } else {
            Err(BackendError::Container(format!(
                "Podman version command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }
}
