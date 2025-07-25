use crate::backend::{BackendError, BackendResult, ContainerConfig, ContainerStatus, ContainerState, HealthStatus, PortMapping, VolumeMount, HealthCheckConfig, SetupProgress};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug, error};

pub struct ContainerManager {
    runtime: ContainerRuntime,
    containers: Arc<DashMap<String, ContainerInfo>>,
    health_monitor: Arc<HealthMonitor>,
    setup_progress: Arc<RwLock<SetupProgress>>,
}

#[derive(Debug, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub config: ContainerConfig,
    pub status: ContainerStatus,
}

pub enum ContainerRuntime {
    Podman(super::podman::PodmanClient),
    Docker(super::docker::DockerClient),
}

impl ContainerManager {
    /// Creates a new container manager with the specified runtime type.
    /// 
    /// # Errors
    /// 
    /// Returns an error if the container runtime client cannot be initialized.
    pub fn new(runtime_type: crate::backend::ContainerRuntimeType) -> BackendResult<Self> {
        let runtime = match runtime_type {
            crate::backend::ContainerRuntimeType::Podman => {
                ContainerRuntime::Podman(super::podman::PodmanClient::new())
            }
            crate::backend::ContainerRuntimeType::Docker => {
                ContainerRuntime::Docker(super::docker::DockerClient::new())
            }
        };

        let health_monitor = Arc::new(HealthMonitor::new());
        
        Ok(Self {
            runtime,
            containers: Arc::new(DashMap::new()),
            health_monitor,
            setup_progress: Arc::new(RwLock::new(SetupProgress {
                stage: "initialized".to_string(),
                progress: 0,
                message: "Container manager initialized".to_string(),
                details: String::new(),
                can_retry: false,
            })),
        })
    }

    /// Creates a new container manager using runtime detection and management.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Runtime manager initialization fails
    /// - Container runtime detection fails
    /// - Container client creation fails
    pub async fn new_with_runtime_manager(
        _preferred_runtime_type: crate::backend::ContainerRuntimeType, 
        resource_dir: std::path::PathBuf
    ) -> BackendResult<Self> {
        let mut runtime_manager = super::RuntimeManager::new(resource_dir);
        
        match runtime_manager.initialize().await {
            Ok(runtime_type) => {
                let (runtime, runtime_name) = match runtime_type {
                    super::RuntimeType::Bundled(path) | 
                    super::RuntimeType::System(path) | 
                    super::RuntimeType::Downloaded(path) => {
                        // Determine if it's Podman or Docker based on the executable name
                        let exe_name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("");
                        
                        if exe_name.contains("docker") {
                            info!("🐳 Initializing Docker client with path: {:?}", path);
                            let client = super::docker::DockerClient::new();
                            (ContainerRuntime::Docker(client), "Docker")
                        } else {
                            info!("🐙 Initializing Podman client with path: {:?}", path);
                            let client = super::podman::PodmanClient::with_path(
                                path.to_string_lossy().to_string()
                            );
                            (ContainerRuntime::Podman(client), "Podman")
                        }
                    }
                };

                let health_monitor = Arc::new(HealthMonitor::new());
                
                Ok(Self {
                    runtime,
                    containers: Arc::new(DashMap::new()),
                    health_monitor,
                    setup_progress: Arc::new(RwLock::new(SetupProgress {
                        stage: "initialized".to_string(),
                        progress: 0,
                        message: format!("Container manager initialized with {runtime_name}"),
                        details: "Runtime detection and initialization completed".to_string(),
                        can_retry: false,
                    })),
                })
            }
            Err(e) => {
                error!("Failed to initialize runtime manager: {}", e);
                Err(e)
            }
        }
    }

    /// Starts a `PostgreSQL` container with default configuration.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container creation fails
    /// - Container startup fails
    /// - Health check configuration is invalid
    pub async fn start_postgres(&self) -> BackendResult<ContainerStatus> {
        self.setup_postgres_init_scripts().await?;
        info!("Starting PostgreSQL container");
        
        let config = ContainerConfig {
            name: "eliza-postgres".to_string(),
            image: "pgvector/pgvector:pg16".to_string(),
            ports: vec![PortMapping::new(5432, 5432)],
            environment: vec![
                "POSTGRES_DB=eliza_game".to_string(),
                "POSTGRES_USER=eliza".to_string(),
                "POSTGRES_PASSWORD=eliza_secure_pass".to_string(),
                "POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=C".to_string(),
            ],
            volumes: vec![
                VolumeMount::new("eliza-postgres-data", "/var/lib/postgresql/data"),
                VolumeMount::new("eliza-postgres-init", "/docker-entrypoint-initdb.d"),
            ],
            health_check: Some(HealthCheckConfig::postgres_default()),
        };

        self.start_container(config).await
    }

    /// Starts an Ollama container for local AI model serving.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container creation fails
    /// - Container startup fails
    /// - Health check configuration is invalid
    pub async fn start_ollama(&self) -> BackendResult<ContainerStatus> {
        info!("Starting Ollama container");
        
        let config = ContainerConfig {
            name: "eliza-ollama".to_string(),
            image: "ollama/ollama:latest".to_string(),
            ports: vec![PortMapping::new(11434, 11434)],
            environment: vec![],
            volumes: vec![VolumeMount::new("eliza-ollama-data", "/root/.ollama")],
            health_check: Some(HealthCheckConfig::ollama_default()),
        };

        self.start_container(config).await
    }


    /// Starts the `ElizaOS` agent container.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Agent container image is not found
    /// - Container creation fails
    /// - Container startup fails
    /// - Environment configuration is invalid
    pub async fn start_agent(&self) -> BackendResult<ContainerStatus> {
        info!("Starting ElizaOS Agent container");
        
        // Check for agentserver images (align with packages/agentserver build system)
        let (image_name, image_exists) = match &self.runtime {
            ContainerRuntime::Podman(client) => {
                if client.image_exists("eliza-agent-server:latest").await.unwrap_or(false) {
                    ("eliza-agent-server:latest".to_string(), true)
                } else if client.image_exists("eliza-agent-working:latest").await.unwrap_or(false) {
                    ("eliza-agent-working:latest".to_string(), true)
                } else if client.image_exists("eliza-agent:latest").await.unwrap_or(false) {
                    ("eliza-agent:latest".to_string(), true)
                } else {
                    ("eliza-agent-server:latest".to_string(), false)
                }
            }
            ContainerRuntime::Docker(client) => {
                if client.image_exists("eliza-agent-server:latest").await.unwrap_or(false) {
                    ("eliza-agent-server:latest".to_string(), true)
                } else if client.image_exists("eliza-agent-working:latest").await.unwrap_or(false) {
                    ("eliza-agent-working:latest".to_string(), true)
                } else if client.image_exists("eliza-agent:latest").await.unwrap_or(false) {
                    ("eliza-agent:latest".to_string(), true)
                } else {
                    ("eliza-agent-server:latest".to_string(), false)
                }
            }
        };

        if !image_exists {
            warn!("ElizaOS Agent image '{}' not found", image_name);
            return Err(crate::backend::BackendError::Container(
                "Agent container image not found. Please build the image first with: cd packages/agentserver && bun run build:binary linux && docker build -f Dockerfile.standalone -t eliza-agent-server:latest .".to_string()
            ));
        }
        
        info!("Using agent container image: {}", image_name);
        
        // Build environment variables for the agent container
        let mut environment = vec![
            "NODE_ENV=production".to_string(),
            "AGENT_CONTAINER=true".to_string(),
            "LOG_LEVEL=info".to_string(),
            "PORT=7777".to_string(),
            "SERVER_PORT=7777".to_string(),
            // Database connection - connects to eliza-postgres container
            "DATABASE_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game".to_string(),
            "POSTGRES_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game".to_string(),
            "POSTGRES_HOST=eliza-postgres".to_string(),
            "POSTGRES_PORT=5432".to_string(),
            "POSTGRES_DB=eliza_game".to_string(),
            "POSTGRES_USER=eliza".to_string(),
            "POSTGRES_PASSWORD=eliza_secure_pass".to_string(),
            // Ollama connection - connects to eliza-ollama container
            "OLLAMA_URL=http://eliza-ollama:11434".to_string(),
            "OLLAMA_SERVER_URL=http://eliza-ollama:11434".to_string(),
            // Model configuration
            "MODEL_PROVIDER=openai".to_string(),
            "TEXT_EMBEDDING_MODEL=text-embedding-3-small".to_string(),
            "LANGUAGE_MODEL=gpt-4o-mini".to_string(),
            // Plugin configuration
            "AUTONOMY_ENABLED=true".to_string(),
            "AUTONOMY_AUTO_START=true".to_string(),
            "LOAD_DOCS_ON_STARTUP=true".to_string(),
            "CTX_KNOWLEDGE_ENABLED=true".to_string(),
            // Agent configuration
            format!("AGENT_ID={}", uuid::Uuid::new_v4()),
        ];

        // Pass through environment variables from host
        let env_vars_to_pass = [
            "USE_SMALL_MODELS",
            "OPENAI_API_KEY", 
            "ANTHROPIC_API_KEY",
            "JWT_SECRET",
            "EMBEDDING_PROVIDER",
            "TEXT_PROVIDER",
            "AUTO_SEND_TEST_MESSAGE"
        ];
        
        for var_name in env_vars_to_pass {
            if let Ok(value) = std::env::var(var_name) {
                info!("🚀 Passing {}={} to agent container", var_name, 
                    if var_name.contains("KEY") || var_name.contains("SECRET") { "[REDACTED]" } else { &value });
                environment.push(format!("{}={}", var_name, value));
            }
        }

        let config = ContainerConfig {
            name: "eliza-agent".to_string(),
            image: image_name,
            ports: vec![PortMapping::new(7777, 7777)], // Agent API port
            environment,
            volumes: vec![
                VolumeMount::new("eliza-agent-data", "/app/data"),
                VolumeMount::new("eliza-agent-logs", "/app/logs"),
                VolumeMount::new("eliza-agent-knowledge", "/app/knowledge"),
            ],
            health_check: Some(HealthCheckConfig::agent_default()),
        };

        self.start_container(config).await
    }

    /// Starts a container with the specified configuration.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container runtime command fails
    /// - Container configuration is invalid
    /// - Health monitoring setup fails
    pub async fn start_container(&self, config: ContainerConfig) -> BackendResult<ContainerStatus> {
        let container_name = config.name.clone();
        
        // Check if container already exists in the runtime (not just in our tracking)
        if let Ok(existing_status) = self.get_runtime_container_status(&container_name).await {
            match existing_status.state {
                ContainerState::Running => {
                    info!("Container {} is already running, reusing it", container_name);
                    
                    // Add the existing container to our tracking
                    let container_info = ContainerInfo {
                        id: existing_status.id.clone(),
                        config: config.clone(),
                        status: existing_status.clone(),
                    };
                    self.containers.insert(container_name.clone(), container_info);
                    
                    return Ok(existing_status);
                }
                ContainerState::Stopped => {
                    info!("Container {} exists but is stopped, restarting it", container_name);
                    // Just start the existing container instead of recreating
                    match &self.runtime {
                        ContainerRuntime::Podman(client) => {
                            if let Err(e) = client.start_existing_container(&container_name).await {
                                info!("Failed to restart existing container, removing and recreating: {}", e);
                                let _ = self.stop_container(&container_name).await;
                                let _ = self.remove_container(&container_name).await;
                            } else {
                                // Get the runtime status and add to tracking
                                let runtime_status = self.get_runtime_container_status(&container_name).await?;
                                let container_info = ContainerInfo {
                                    id: runtime_status.id.clone(),
                                    config: config.clone(),
                                    status: runtime_status.clone(),
                                };
                                self.containers.insert(container_name.clone(), container_info);
                                return Ok(runtime_status);
                            }
                        }
                        ContainerRuntime::Docker(_client) => {
                            // For Docker, we'll implement similar logic later
                            info!("Removing existing Docker container: {}", container_name);
                            let _ = self.stop_container(&container_name).await;
                            let _ = self.remove_container(&container_name).await;
                        }
                    }
                }
                _ => {
                    info!("Container {} exists in unknown state, removing and recreating", container_name);
                    let _ = self.stop_container(&container_name).await;
                    let _ = self.remove_container(&container_name).await;
                }
            }
        }

        // Start new container
        let container_id = match &self.runtime {
            ContainerRuntime::Podman(client) => client.start_container(&config).await?,
            ContainerRuntime::Docker(client) => client.start_container(&config).await?,
        };

        let status = ContainerStatus {
            id: container_id.clone(),
            name: container_name.clone(),
            state: ContainerState::Starting,
            health: HealthStatus::Starting,
            ports: config.ports.clone(),
            started_at: Some(chrono::Utc::now().timestamp()),
            uptime_seconds: 0,
            restart_count: 0,
        };

        // Store container info
        let container_info = ContainerInfo {
            id: container_id,
            config: config.clone(),
            status: status.clone(),
        };
        
        self.containers.insert(container_name.clone(), container_info);

        // Start health monitoring if configured
        if let Some(health_check) = config.health_check {
            self.health_monitor.start_monitoring(
                container_name.clone(),
                health_check,
                self.containers.clone(),
            ).await;
        }

        info!("Container {} started successfully", container_name);
        Ok(status)
    }

    /// Stops a running container by name.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container runtime command fails
    /// - Container is not found or not running
    pub async fn stop_container(&self, name: &str) -> BackendResult<()> {
        info!("Stopping container: {}", name);
        
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.stop_container(name).await?,
            ContainerRuntime::Docker(client) => client.stop_container(name).await?,
        }

        // Stop health monitoring
        self.health_monitor.stop_monitoring(name).await;

        // Update container status
        if let Some(mut container_info) = self.containers.get_mut(name) {
            container_info.status.state = ContainerState::Stopped;
            container_info.status.health = HealthStatus::Unknown;
        }

        info!("Container {} stopped successfully", name);
        Ok(())
    }

    /// Removes a container by name.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container runtime command fails
    /// - Container is still running and cannot be force-removed
    pub async fn remove_container(&self, name: &str) -> BackendResult<()> {
        info!("Removing container: {}", name);
        
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.remove_container(name).await?,
            ContainerRuntime::Docker(client) => client.remove_container(name).await?,
        }

        // Remove from tracking
        self.containers.remove(name);

        info!("Container {} removed successfully", name);
        Ok(())
    }

    /// Restarts a container by stopping and starting it again.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container is not found in the manager
    /// - Stop or start operations fail
    /// - Container configuration is invalid on restart
    pub async fn restart_container(&self, name: &str) -> BackendResult<ContainerStatus> {
        info!("Restarting container: {}", name);
        
        // Get current config
        let config = if let Some(container_info) = self.containers.get(name) {
            container_info.config.clone()
        } else {
            return Err(BackendError::Container(format!("Container {name} not found")));
        };

        // Stop and start
        let _ = self.stop_container(name).await;
        let mut status = self.start_container(config).await?;

        // Update restart count
        if let Some(mut container_info) = self.containers.get_mut(name) {
            container_info.status.restart_count += 1;
            status.restart_count = container_info.status.restart_count;
        }

        info!("Container {} restarted successfully", name);
        Ok(status)
    }

    /// Gets the current status of a container by name from our internal tracking.
    /// 
    /// # Errors
    /// 
    /// Returns an error if the container is not found in the manager.
    pub async fn get_container_status(&self, name: &str) -> BackendResult<ContainerStatus> {
        if let Some(container_info) = self.containers.get(name) {
            Ok(container_info.status.clone())
        } else {
            Err(BackendError::Container(format!("Container {name} not found")))
        }
    }

    /// Gets the current status of a container by querying the runtime directly.
    /// This checks if the container actually exists in Podman/Docker, not just our tracking.
    /// 
    /// # Errors
    /// 
    /// Returns an error if the container runtime query fails or container is not found.
    pub async fn get_runtime_container_status(&self, name: &str) -> BackendResult<ContainerStatus> {
        match &self.runtime {
            ContainerRuntime::Podman(client) => {
                client.get_container_status(name).await
            }
            ContainerRuntime::Docker(client) => {
                client.get_container_status(name).await
            }
        }
    }

    /// Gets the status of all managed containers.
    /// 
    /// # Errors
    /// 
    /// This function currently never returns an error but uses Result for consistency.
    pub async fn get_all_statuses(&self) -> BackendResult<Vec<ContainerStatus>> {
        let statuses: Vec<ContainerStatus> = self.containers
            .iter()
            .map(|entry| entry.value().status.clone())
            .collect();
        
        Ok(statuses)
    }

    /// Stops all managed containers.
    /// 
    /// # Errors
    /// 
    /// This function logs individual container stop failures but does not return an error.
    /// It continues attempting to stop all containers even if some fail.
    pub async fn stop_containers(&self) -> BackendResult<()> {
        info!("Stopping all containers");

        let container_names: Vec<String> = self.containers
            .iter()
            .map(|entry| entry.key().clone())
            .collect();

        for name in container_names {
            if let Err(e) = self.stop_container(&name).await {
                warn!("Failed to stop container {}: {}", name, e);
            }
        }

        info!("All containers stopped");
        Ok(())
    }

    /// Sets up the complete container environment including networking and all services.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container runtime is not available
    /// - Network creation fails
    /// - Image loading fails
    /// - Any container startup fails
    pub async fn setup_complete_environment(&self, resource_dir: &std::path::Path) -> BackendResult<()> {
        self.update_progress("checking", 0, "Checking container runtime...", "Verifying runtime availability").await;

        // Check runtime availability
        let available = match &self.runtime {
            ContainerRuntime::Podman(client) => client.is_available().await?,
            ContainerRuntime::Docker(client) => client.is_available().await?,
        };

        if !available {
            return Err(BackendError::Container("Container runtime not available".to_string()));
        }

        self.update_progress("network", 10, "Creating container network...", "Setting up eliza-network for inter-container communication").await;
        
        // Create the eliza network for container communication
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.create_network("eliza-network").await?,
            ContainerRuntime::Docker(client) => client.create_network("eliza-network").await?,
        }

        self.update_progress("installing", 20, "Loading container images...", "Loading PostgreSQL and Ollama images").await;

        // Load bundled images if they exist
        self.load_bundled_images(resource_dir).await?;

        self.update_progress("starting", 50, "Starting PostgreSQL...", "Initializing database container").await;
        self.start_postgres().await?;

        self.update_progress("starting", 60, "Starting Ollama...", "Initializing AI model container").await;
        self.start_ollama().await?;

        self.update_progress("starting", 80, "Starting ElizaOS Agent...", "Initializing conversational AI agent").await;
        self.start_agent().await?;

        self.update_progress("complete", 100, "Setup complete!", "All containers are running").await;

        info!("Complete environment setup finished successfully");
        Ok(())
    }

    async fn load_bundled_images(&self, resource_dir: &std::path::Path) -> BackendResult<()> {
        let images_dir = resource_dir.join("container-images");
        
        if !images_dir.exists() {
            debug!("No bundled images directory found, skipping");
            return Ok(());
        }

        // Load PostgreSQL image
        let postgres_image = images_dir.join("eliza-postgres.tar");
        if postgres_image.exists() {
            info!("Loading PostgreSQL image from bundle");
            match &self.runtime {
                ContainerRuntime::Podman(client) => client.load_image(&postgres_image).await?,
                ContainerRuntime::Docker(client) => client.load_image(&postgres_image).await?,
            }
        }

        // Load Ollama image
        let ollama_image = images_dir.join("eliza-ollama.tar");
        if ollama_image.exists() {
            info!("Loading Ollama image from bundle");
            match &self.runtime {
                ContainerRuntime::Podman(client) => client.load_image(&ollama_image).await?,
                ContainerRuntime::Docker(client) => client.load_image(&ollama_image).await?,
            }
        }

        Ok(())
    }

    pub async fn get_setup_progress(&self) -> SetupProgress {
        self.setup_progress.read().await.clone()
    }
    
    /// Creates a container network with the specified name.
    /// 
    /// # Errors
    /// 
    /// Returns an error if:
    /// - Container runtime command fails
    /// - Network creation command fails
    /// - Network already exists with conflicting configuration
    pub async fn create_network(&self, network_name: &str) -> BackendResult<()> {
        info!("Creating container network: {}", network_name);
        
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.create_network(network_name).await,
            ContainerRuntime::Docker(client) => client.create_network(network_name).await,
        }
    }

    async fn update_progress(&self, stage: &str, progress: u8, message: &str, details: &str) {
        let mut progress_guard = self.setup_progress.write().await;
        progress_guard.stage = stage.to_string();
        progress_guard.progress = progress;
        progress_guard.message = message.to_string();
        progress_guard.details = details.to_string();
        progress_guard.can_retry = matches!(stage, "error");
        
        info!("Setup progress: {} - {} ({}%)", stage, message, progress);
    }
    
    /// Sets up PostgreSQL initialization scripts
    async fn setup_postgres_init_scripts(&self) -> BackendResult<()> {
        // Create a named volume for PostgreSQL init scripts
        match &self.runtime {
            ContainerRuntime::Podman(_client) => {
                // Create volume for init scripts
                let output = std::process::Command::new("podman")
                    .args(["volume", "create", "eliza-postgres-init"])
                    .output()
                    .map_err(|e| BackendError::Container(format!("Failed to create init volume: {e}")))?
                    ;
                    
                if !output.status.success() {
                    let error = String::from_utf8_lossy(&output.stderr);
                    // Ignore "already exists" errors
                    if !error.contains("already exists") {
                        warn!("Could not create init volume: {}", error);
                    }
                }
            }
            ContainerRuntime::Docker(_client) => {
                // Similar for Docker if needed
            }
        }
        
        Ok(())
    }
}

// Re-export the health monitor
pub use super::health::HealthMonitor;