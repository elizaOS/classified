use crate::backend::{BackendError, BackendResult, ContainerConfig, ContainerStatus, ContainerState, HealthStatus};
use crate::container::runtime_trait::ContainerRuntime;
use async_trait::async_trait;

use std::path::Path;
use tracing::warn;

// Helper function to parse Docker uptime strings
fn parse_docker_uptime(status: &str) -> u64 {
    // Status examples: "Up 2 hours", "Up 3 minutes", "Exited (0) 3 hours ago"
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

// Helper function to parse Docker timestamp
fn parse_docker_timestamp(_timestamp: &str) -> Option<i64> {
    // Timestamp format: "2024-01-01 12:00:00 +0000 UTC"
    // For now, return None as parsing this format is complex
    // In production, you'd use a proper date parsing library
    None
}

#[derive(Clone)]
pub struct DockerClient {
    docker_path: String,
}

impl Default for DockerClient {
    fn default() -> Self {
        Self::new()
    }
}

impl DockerClient {
    pub fn new() -> Self {
        Self {
            docker_path: "docker".to_string(),
        }
    }

    pub fn with_path(path: String) -> Self {
        Self { docker_path: path }
    }

    pub fn get_path(&self) -> &str {
        &self.docker_path
    }

    pub async fn create_network(&self, network_name: &str) -> BackendResult<()> {
        // Check if network already exists
        let check_output = std::process::Command::new(&self.docker_path)
            .args(["network", "ls", "--format", "{{.Name}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list networks: {e}")))?;

        let networks = String::from_utf8_lossy(&check_output.stdout);
        if networks.lines().any(|n| n.trim() == network_name) {
            return Ok(());
        }

        // Create the network
        let output = std::process::Command::new(&self.docker_path)
            .args(["network", "create", network_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to create network: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(BackendError::Container(format!(
                "Failed to create network {network_name}: {error_msg}"
            )));
        }

        Ok(())
    }

    pub async fn is_available(&self) -> BackendResult<bool> {
        // Check if Docker is available by running 'docker version'
        match std::process::Command::new(&self.docker_path)
            .arg("version")
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    Ok(true)
                } else {
                    warn!(
                        "Docker command failed: {}",
                        String::from_utf8_lossy(&output.stderr)
                    );
                    Ok(false)
                }
            }
            Err(e) => {
                warn!("Docker not available: {}", e);
                Ok(false)
            }
        }
    }

    pub async fn start_container_impl(&self, config: &ContainerConfig) -> BackendResult<String> {
        warn!("Docker implementation is basic - using simple docker run command");

        let mut cmd = std::process::Command::new(&self.docker_path);
        cmd.args(["run", "-d", "--name", &config.name]);

        // Add port mappings
        for port in &config.ports {
            cmd.args(["-p", &format!("{}:{}", port.host_port, port.container_port)]);
        }

        // Add environment variables
        for env in &config.environment {
            cmd.args(["-e", env]);
        }

        // Add volumes
        for volume in &config.volumes {
            cmd.args([
                "-v",
                &format!("{}:{}", volume.host_path, volume.container_path),
            ]);
        }

        // Add container to network for inter-container communication
        if let Some(network) = &config.network {
            cmd.args(["--network", network]);
        }

        // Add memory limit if specified
        if let Some(memory_limit) = &config.memory_limit {
            cmd.args(["-m", memory_limit]);
        }

        cmd.arg(&config.image);

        match cmd.output() {
            Ok(output) => {
                if output.status.success() {
                    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    Ok(container_id)
                } else {
                    Err(BackendError::Container(format!(
                        "Failed to start Docker container: {}",
                        String::from_utf8_lossy(&output.stderr)
                    )))
                }
            }
            Err(e) => Err(BackendError::Container(format!(
                "Docker command failed: {e}"
            ))),
        }
    }

    pub async fn stop_container(&self, name: &str) -> BackendResult<()> {
        match std::process::Command::new(&self.docker_path)
            .args(["stop", name])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err(BackendError::Container(format!(
                        "Failed to stop Docker container: {}",
                        String::from_utf8_lossy(&output.stderr)
                    )))
                }
            }
            Err(e) => Err(BackendError::Container(format!(
                "Docker command failed: {e}"
            ))),
        }
    }

    pub async fn remove_container(&self, name: &str) -> BackendResult<()> {
        match std::process::Command::new(&self.docker_path)
            .args(["rm", "-f", name])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err(BackendError::Container(format!(
                        "Failed to remove Docker container: {}",
                        String::from_utf8_lossy(&output.stderr)
                    )))
                }
            }
            Err(e) => Err(BackendError::Container(format!(
                "Docker command failed: {e}"
            ))),
        }
    }

    pub async fn load_image(&self, image_path: &Path) -> BackendResult<()> {
        let output = std::process::Command::new(&self.docker_path)
            .args(["load", "-i", &image_path.to_string_lossy()])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to load Docker image: {e}")))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(BackendError::Container(format!(
                "Failed to load Docker image: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }

    pub async fn image_exists(&self, image_name: &str) -> BackendResult<bool> {
        match std::process::Command::new(&self.docker_path)
            .args(["images", "-q", image_name])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    let images_list = String::from_utf8_lossy(&output.stdout);
                    Ok(!images_list.trim().is_empty())
                } else {
                    Ok(false)
                }
            }
            Err(_) => Ok(false),
        }
    }

    pub async fn get_container_status_impl(
        &self,
        container_name: &str,
    ) -> BackendResult<crate::backend::ContainerStatus> {
        let output = std::process::Command::new(&self.docker_path)
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
                "Container {} not found",
                container_name
            )));
        }

        // Parse the first matching line
        let line = lines[0];
        let parts: Vec<&str> = line.split(':').collect();

        if parts.len() < 6 {
            return Err(BackendError::Container(format!(
                "Invalid container status format: {}",
                line
            )));
        }

        let state = match parts[3] {
            "running" => crate::backend::ContainerState::Running,
            "paused" => crate::backend::ContainerState::Stopped,
            "exited" => crate::backend::ContainerState::Stopped,
            "created" => crate::backend::ContainerState::Starting,
            _ => crate::backend::ContainerState::Unknown,
        };

        let health = match state {
            crate::backend::ContainerState::Running => crate::backend::HealthStatus::Healthy,
            _ => crate::backend::HealthStatus::Unknown,
        };
        
        // Parse uptime from status field (e.g., "Up 2 hours" or "Exited (0) 3 hours ago")
        let uptime_seconds = parse_docker_uptime(parts[4]);
        
        // Parse created time
        let started_at = parse_docker_timestamp(parts[5]);

        Ok(crate::backend::ContainerStatus {
            id: parts[0].to_string(),
            name: parts[1].to_string(),
            image: parts[2].to_string(),
            state,
            health,
            ports: vec![],
            started_at,
            uptime_seconds,
            restart_count: 0, // Docker doesn't provide this in ps output
        })
    }

    pub async fn list_containers_by_pattern(&self, pattern: &str) -> BackendResult<Vec<String>> {
        let output = std::process::Command::new(&self.docker_path)
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

    pub async fn container_exists(&self, container_name: &str) -> BackendResult<bool> {
        match std::process::Command::new(&self.docker_path)
            .args(["container", "inspect", container_name])
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
        match std::process::Command::new(&self.docker_path)
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

    /// Execute a command inside a running container
    pub async fn exec(
        &self,
        container_name: &str,
        command: &[&str],
    ) -> BackendResult<std::process::Output> {
        let mut args = vec!["exec", container_name];
        args.extend(command);

        let output = tokio::process::Command::new(&self.docker_path)
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

    pub async fn start_existing_container(&self, container_name: &str) -> BackendResult<()> {
        match std::process::Command::new(&self.docker_path)
            .args(["start", container_name])
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    // Check if container doesn't exist
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("No such container") {
                        Err(BackendError::Container(format!(
                            "Container {} not found",
                            container_name
                        )))
                    } else {
                        Err(BackendError::Container(format!(
                            "Failed to start container {}: {}",
                            container_name, stderr
                        )))
                    }
                }
            }
            Err(e) => Err(BackendError::Container(format!(
                "Docker command failed: {e}"
            ))),
        }
    }
}

// Implement the unified ContainerRuntime trait
#[async_trait]
impl ContainerRuntime for DockerClient {
    async fn is_available(&self) -> BackendResult<bool> {
        self.is_available().await
    }



    async fn create_network(&self, network_name: &str) -> BackendResult<()> {
        self.create_network(network_name).await
    }

    async fn network_exists(&self, network_name: &str) -> BackendResult<bool> {
        let output = std::process::Command::new(&self.docker_path)
            .args(["network", "ls", "--format", "{{.Name}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list networks: {e}")))?;

        let networks = String::from_utf8_lossy(&output.stdout);
        Ok(networks.lines().any(|n| n.trim() == network_name))
    }

    async fn remove_network(&self, network_name: &str) -> BackendResult<()> {
        let output = std::process::Command::new(&self.docker_path)
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
        self.start_container_impl(config).await
    }

    async fn start_container(&self, _container_id: &str) -> BackendResult<()> {
        // For Docker, start_container_impl does both create and start
        // This is a no-op since we don't separate create and start in our impl
        Ok(())
    }

    async fn stop_container(&self, container_name: &str) -> BackendResult<()> {
        let output = std::process::Command::new(&self.docker_path)
            .args(["stop", container_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to stop container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            warn!("Failed to stop container {}: {}", container_name, error_msg);
        }

        Ok(())
    }

    async fn remove_container(&self, container_name: &str) -> BackendResult<()> {
        let output = std::process::Command::new(&self.docker_path)
            .args(["rm", "-f", container_name])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to remove container: {e}")))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            warn!("Failed to remove container {}: {}", container_name, error_msg);
        }

        Ok(())
    }

    async fn restart_container(&self, container_name: &str) -> BackendResult<()> {
        let output = std::process::Command::new(&self.docker_path)
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
        let output = std::process::Command::new(&self.docker_path)
            .args(["ps", "-a", "--format", "{{.Names}}"])
            .output()
            .map_err(|e| BackendError::Container(format!("Failed to list containers: {e}")))?;

        let containers = String::from_utf8_lossy(&output.stdout);
        Ok(containers.lines().any(|name| name.trim() == container_name))
    }

    async fn get_container_status(&self, container_name: &str) -> BackendResult<ContainerStatus> {
        // First, try to get detailed status from ps command
        match self.get_container_status_impl(container_name).await {
            Ok(status) => Ok(status),
            Err(_) => {
                // Fallback to inspect if ps fails
                let output = std::process::Command::new(&self.docker_path)
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
                    
                    // Calculate uptime if running
                    let uptime_seconds = if state == ContainerState::Running {
                        // Would need proper timestamp parsing here
                        0 // Simplified for now
                    } else {
                        0
                    };

                    Ok(ContainerStatus {
                        id: parts[2].to_string(),
                        name: container_name.to_string(),
                        image: parts[1].to_string(),
                        state,
                        health: HealthStatus::Unknown,
                        ports: Vec::new(),
                        started_at: None, // Would parse parts[3] here
                        uptime_seconds,
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
        use tokio::process::Command;

        let mut child = Command::new(&self.docker_path)
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
        let output = std::process::Command::new(&self.docker_path)
            .args(["version", "--format", "json"])
            .output()
            .map_err(|e| BackendError::Container(format!("Docker version command failed: {}", e)))?;

        if !output.status.success() {
            return Err(BackendError::Container(format!(
                "Docker version command failed: {}",
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
        let output = std::process::Command::new(&self.docker_path)
            .args(["--version"])
            .output()
            .map_err(|e| BackendError::Container(format!("Docker version command failed: {}", e)))?;

        if output.status.success() {
            let version_line = String::from_utf8_lossy(&output.stdout);
            // Parse "Docker version 24.0.7, build afdd53b" -> "24.0.7"
            if let Some(version) = version_line
                .split_whitespace()
                .nth(2)
                .and_then(|s| s.trim_end_matches(',').strip_prefix("").map(|s| s.to_string()))
            {
                Ok(version)
            } else {
                Ok(version_line.trim().to_string())
            }
        } else {
            Err(BackendError::Container(format!(
                "Docker version command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }
}
