use crate::backend::{
    BackendError, BackendResult, ContainerConfig, ContainerState, ContainerStatus,
    HealthCheckConfig, HealthStatus, ModelDownloadProgress, ModelDownloadStatus, PortMapping,
    SetupProgress, VolumeMount,
};
use crate::container::runtime_manager::RuntimeType;
use crate::container::retry::{retry_with_backoff, RetryConfig, is_retryable_error};
use dashmap::DashMap;
use std::sync::Arc;
use std::process::Stdio;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

pub struct ContainerManager {
    runtime: ContainerRuntime,
    containers: Arc<DashMap<String, ContainerInfo>>,
    health_monitor: Arc<HealthMonitor>,
    log_streamer: Arc<LogStreamManager>,
    setup_progress: Arc<RwLock<SetupProgress>>,
    app_handle: Option<AppHandle>,
    resource_dir: Option<std::path::PathBuf>,
    podman_restart_mutex: Arc<Mutex<()>>,
}

#[derive(Debug, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub config: ContainerConfig,
    pub status: ContainerStatus,
}

#[derive(Clone)]
pub enum ContainerRuntime {
    Podman(super::podman::PodmanClient),
    Docker(super::docker::DockerClient),
}

/// Manages log streaming tasks for containers
pub struct LogStreamManager {
    /// Active log streaming tasks
    streams: Arc<DashMap<String, LogStreamTask>>,
}

struct LogStreamTask {
    /// Handle to the spawned log streaming task
    handle: JoinHandle<()>,
    /// Handle to the child process (podman/docker logs command)
    child_handle: JoinHandle<()>,
}

impl LogStreamManager {
    #[must_use]
    pub fn new() -> Self {
        Self {
            streams: Arc::new(DashMap::new()),
        }
    }

    /// Stop log streaming for a specific container
    pub async fn stop_streaming(&self, container_name: &str) {
        if let Some((_, task)) = self.streams.remove(container_name) {
            task.handle.abort();
            task.child_handle.abort();
            info!("Stopped log streaming for container: {}", container_name);
        }
    }

    /// Stop all log streaming
    pub async fn stop_all_streaming(&self) {
        let container_names: Vec<String> = self
            .streams
            .iter()
            .map(|entry| entry.key().clone())
            .collect();

        for name in container_names {
            self.stop_streaming(&name).await;
        }

        info!("Stopped all log streaming");
    }
}

impl Default for LogStreamManager {
    fn default() -> Self {
        Self::new()
    }
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
            log_streamer: Arc::new(LogStreamManager::new()),
            setup_progress: Arc::new(RwLock::new(SetupProgress {
                stage: "initialized".to_string(),
                progress: 0,
                message: "Container manager initialized".to_string(),
                details: String::new(),
                can_retry: false,
                model_progress: None,
            })),
            app_handle: None,
            resource_dir: None,
            podman_restart_mutex: Arc::new(Mutex::new(())),
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
        resource_dir: std::path::PathBuf,
    ) -> BackendResult<Self> {
        let mut runtime_manager = super::RuntimeManager::new(resource_dir.clone());

        match runtime_manager.initialize().await {
            Ok(runtime_type) => {
                let (runtime, runtime_name) = match runtime_type {
                    RuntimeType::Bundled(path)
                    | RuntimeType::System(path)
                    | RuntimeType::Downloaded(path) => {
                        // Determine if it's Podman or Docker based on the executable name
                        let exe_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                        if exe_name.contains("docker") {
                            info!("🐳 Initializing Docker client with path: {:?}", path);
                            let client = super::docker::DockerClient::new();
                            (ContainerRuntime::Docker(client), "Docker")
                        } else {
                            info!("🐙 Initializing Podman client with path: {:?}", path);
                            let client = super::podman::PodmanClient::with_path(
                                path.to_string_lossy().to_string(),
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
                    log_streamer: Arc::new(LogStreamManager::new()),
                    setup_progress: Arc::new(RwLock::new(SetupProgress {
                        stage: "initialized".to_string(),
                        progress: 0,
                        message: format!("Container manager initialized with {runtime_name}"),
                        details: "Runtime detection and initialization completed".to_string(),
                        can_retry: false,
                        model_progress: None,
                    })),
                    app_handle: None,
                    resource_dir: Some(resource_dir),
                    podman_restart_mutex: Arc::new(Mutex::new(())),
                })
            }
            Err(e) => {
                error!("Failed to initialize runtime manager: {}", e);
                Err(e)
            }
        }
    }

    /// Sets the AppHandle for emitting events to the frontend
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
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
                "POSTGRES_DB=eliza".to_string(),
                "POSTGRES_USER=eliza".to_string(),
                "POSTGRES_PASSWORD=eliza_secure_pass".to_string(),
                "POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=C".to_string(),
            ],
            volumes: vec![
                VolumeMount::new("eliza-postgres-data", "/var/lib/postgresql/data"),
                VolumeMount::new("eliza-postgres-init", "/docker-entrypoint-initdb.d"),
            ],
            health_check: Some(HealthCheckConfig::postgres_default()),
            network: Some("eliza-network".to_string()),
            memory_limit: Some("2g".to_string()),
        };

        let status = self.start_container(config).await?;
        
        // Start streaming container logs to the Tauri app logs
        info!("🔍 Starting log streaming for eliza-postgres container");
        if let Err(e) = self.stream_container_logs("eliza-postgres").await {
            warn!("⚠️ Failed to start log streaming for eliza-postgres: {}", e);
            // Don't fail the container start if log streaming fails
        }
        
        Ok(status)
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
        info!("Checking for Ollama service");

        // Check if Ollama is already running on port 11434
        if self.is_ollama_already_running().await {
            info!("✅ Found existing Ollama instance running on port 11434, using it instead of starting a container");
            return Ok(ContainerStatus {
                id: "native-ollama".to_string(),
                name: "ollama-native".to_string(),
                state: ContainerState::Running,
                health: HealthStatus::Healthy,
                ports: vec![PortMapping::new(11434, 11434)],
                started_at: Some(chrono::Utc::now().timestamp()),
                uptime_seconds: 0,
                restart_count: 0,
            });
        }

        info!("No existing Ollama found, starting Ollama container");

        let config = ContainerConfig {
            name: "eliza-ollama".to_string(),
            image: "ollama/ollama:latest".to_string(),
            ports: vec![PortMapping::new(11434, 11434)],
            environment: vec!["OLLAMA_PORT=11434".to_string()],
            volumes: vec![VolumeMount::new("eliza-ollama-data", "/root/.ollama")],
            health_check: Some(HealthCheckConfig::ollama_default()),
            network: Some("eliza-network".to_string()),
            memory_limit: Some("16g".to_string()), // 16GB for Ollama to handle large models
        };

        let status = self.start_container(config).await?;
        
        // Ollama log streaming disabled per user request
        // Only streaming logs from agent server and postgres containers
        
        Ok(status)
    }

    /// Get current download progress from Ollama API
    #[allow(dead_code)]
    async fn get_ollama_download_progress(
        &self,
        model: &str,
    ) -> BackendResult<Option<ModelDownloadProgress>> {
        debug!("Getting download progress for model: {}", model);

        // Check if we're using native Ollama
        let is_native = self.is_ollama_already_running().await;
        
        // Query Ollama API
        let output = if is_native {
            // For native Ollama, run curl directly
            tokio::process::Command::new("curl")
                .args([
                    "-s",
                    "http://localhost:11434/api/show",
                    "-d",
                    &format!(r#"{{"name":"{}"}}"#, model),
                ])
                .output()
                .await
                .map_err(|e| {
                    BackendError::Container(format!("Failed to query ollama API: {}", e))
                })?
        } else {
            // For containerized Ollama, use curl inside the container
            match &self.runtime {
                ContainerRuntime::Podman(_) => tokio::process::Command::new("podman")
                    .args([
                        "exec",
                        "eliza-ollama",
                        "curl",
                        "-s",
                        "http://localhost:11434/api/show",
                        "-d",
                        &format!(r#"{{"name":"{}"}}"#, model),
                    ])
                    .output()
                    .await
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to query ollama API: {}", e))
                    })?,
                ContainerRuntime::Docker(_) => tokio::process::Command::new("docker")
                    .args([
                        "exec",
                        "eliza-ollama",
                        "curl",
                        "-s",
                        "http://localhost:11434/api/show",
                        "-d",
                        &format!(r#"{{"name":"{}"}}"#, model),
                    ])
                    .output()
                    .await
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to query ollama API: {}", e))
                    })?,
            }
        };

        if !output.status.success() {
            // Model might not exist or be downloading
            return Ok(None);
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&output_str) {
            // If we get a full response, model is already downloaded
            if json.get("modelfile").is_some() {
                return Ok(Some(ModelDownloadProgress {
                    model_name: model.to_string(),
                    current_mb: 0.0,
                    total_mb: 0.0,
                    percentage: 100,
                    speed_mbps: 0.0,
                    eta_seconds: 0,
                    status: ModelDownloadStatus::AlreadyExists,
                }));
            }
        }

        Ok(None)
    }

    /// Check if an Ollama model is already downloaded
    async fn check_ollama_model_exists(&self, model: &str) -> BackendResult<bool> {
        debug!("Checking if Ollama model exists: {}", model);

        // First check if we're using native Ollama
        let is_native = self.is_ollama_already_running().await;
        
        let output = if is_native {
            // For native Ollama, run the command directly
            tokio::process::Command::new("ollama")
                .args(["list"])
                .output()
                .await
                .map_err(|e| {
                    BackendError::Container(format!("Failed to list ollama models: {}", e))
                })?
        } else {
            // For containerized Ollama, use exec
            match &self.runtime {
                ContainerRuntime::Podman(_) => tokio::process::Command::new("podman")
                    .args(["exec", "eliza-ollama", "ollama", "list"])
                    .output()
                    .await
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to list ollama models: {}", e))
                    })?,
                ContainerRuntime::Docker(_) => tokio::process::Command::new("docker")
                    .args(["exec", "eliza-ollama", "ollama", "list"])
                    .output()
                    .await
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to list ollama models: {}", e))
                    })?,
            }
        };

        if !output.status.success() {
            // If ollama list fails, assume model doesn't exist
            debug!("Ollama list command failed, assuming model doesn't exist");
            return Ok(false);
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        // Check if the model name appears in the output
        // Ollama list format: "model:tag    ID    SIZE    MODIFIED"
        let exists = output_str.lines().any(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                let model_name = parts[0];
                model_name == model || model_name.starts_with(&format!("{}:", model))
            } else {
                false
            }
        });

        debug!("Model {} exists: {}", model, exists);
        Ok(exists)
    }

    /// Handle Podman connection errors by ensuring Podman is running
    async fn handle_podman_connection_error(&self, error: &BackendError) -> BackendResult<()> {
        // Check if this is a retryable error
        if !is_retryable_error(error) {
            // Not a connection error, return the original error
            return Err(BackendError::Container(error.to_string()));
        }

        let error_str = error.to_string();
        warn!("Podman connection error detected: {}", error_str);
        
        // Use retry mechanism to recover Podman connection
        retry_with_backoff(
            "Podman connection recovery",
            RetryConfig::podman_recovery(),
            || async {
                // Delegate to ensure_podman_running which handles synchronization
                self.ensure_podman_running().await?;
                
                // Give Podman a moment to stabilize
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                // Verify connection is working
                match &self.runtime {
                    ContainerRuntime::Podman(client) => {
                        client.is_available().await?;
                    }
                    _ => {}
                }
                
                Ok(())
            },
        )
        .await
    }

    /// Pulls required Ollama models for the agent with progress tracking
    pub async fn pull_ollama_models(&self) -> BackendResult<()> {
        info!("Pulling required Ollama models...");

        // List of models required by the agent
        let required_models = [
            "nomic-embed-text", // Embedding model
            "llama3.2:3b",      // Text generation model (3B params, ~2GB)
        ];

        // Pull each model with progress tracking
        for (index, model) in required_models.iter().enumerate() {
            info!("Processing Ollama model: {}", model);

            // Update overall progress for this model
            let base_progress = 50 + (index as u8 * 25); // Models are 50-75% and 75-100% of setup

            // Check if model already exists
            match self.check_ollama_model_exists(model).await {
                Ok(true) => {
                    info!("Model {} already exists, skipping download", model);
                    let model_progress = ModelDownloadProgress {
                        model_name: model.to_string(),
                        current_mb: 0.0,
                        total_mb: 0.0,
                        percentage: 100,
                        speed_mbps: 0.0,
                        eta_seconds: 0,
                        status: ModelDownloadStatus::AlreadyExists,
                    };
                    self.update_progress_with_model(
                        "models",
                        base_progress + 25,
                        &format!("Model {} already exists", model),
                        &format!(
                            "Using existing {} ({}/{} models)",
                            model,
                            index + 1,
                            required_models.len()
                        ),
                        Some(model_progress),
                    )
                    .await;
                    continue;
                }
                Ok(false) => {
                    info!("Model {} not found, downloading...", model);
                }
                Err(e) => {
                    warn!(
                        "Failed to check if model exists: {}, will attempt to pull",
                        e
                    );
                }
            }

            self.update_progress_with_model(
                "models",
                base_progress,
                &format!("Downloading model: {}", model),
                &format!(
                    "Pulling {} ({}/{} models)",
                    model,
                    index + 1,
                    required_models.len()
                ),
                None,
            )
            .await;

            match self
                .pull_single_model_with_progress(model, base_progress)
                .await
            {
                Ok(()) => {
                    info!("Successfully pulled model: {}", model);
                    // Update to show this model is complete
                    let model_progress = ModelDownloadProgress {
                        model_name: model.to_string(),
                        current_mb: 0.0, // Will be filled with actual values
                        total_mb: 0.0,
                        percentage: 100,
                        speed_mbps: 0.0,
                        eta_seconds: 0,
                        status: ModelDownloadStatus::Completed,
                    };
                    self.update_progress_with_model(
                        "models",
                        base_progress + 25,
                        &format!("Model {} downloaded successfully", model),
                        &format!(
                            "Completed {} ({}/{} models)",
                            model,
                            index + 1,
                            required_models.len()
                        ),
                        Some(model_progress),
                    )
                    .await;
                }
                Err(e) => {
                    // Check if model already exists (not an error)
                    let error_msg = e.to_string();
                    if error_msg.contains("already exists") {
                        info!("Model {} already exists", model);
                        let model_progress = ModelDownloadProgress {
                            model_name: model.to_string(),
                            current_mb: 0.0,
                            total_mb: 0.0,
                            percentage: 100,
                            speed_mbps: 0.0,
                            eta_seconds: 0,
                            status: ModelDownloadStatus::AlreadyExists,
                        };
                        self.update_progress_with_model(
                            "models",
                            base_progress + 25,
                            &format!("Model {} already exists", model),
                            &format!(
                                "Skipped {} (already exists) ({}/{} models)",
                                model,
                                index + 1,
                                required_models.len()
                            ),
                            Some(model_progress),
                        )
                        .await;
                    } else {
                        return Err(e);
                    }
                }
            }
        }

        info!("✅ All required Ollama models pulled successfully");
        Ok(())
    }

    /// Pull a single model with streaming progress updates
    async fn pull_single_model_with_progress(
        &self,
        model: &str,
        base_progress: u8,
    ) -> BackendResult<()> {
        use std::process::Stdio;
        use tokio::io::{AsyncBufReadExt, BufReader};
        use tokio::process::Command;

        // Start a background task to periodically check download progress via API
        let model_clone = model.to_string();
        let self_clone = self.clone();
        let base_progress_clone = base_progress;

        let progress_task = tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                // Try to get progress from API
                if let Ok(Some(progress)) =
                    self_clone.get_ollama_download_progress(&model_clone).await
                {
                    debug!("API Progress for {}: {}%", model_clone, progress.percentage);

                    // Calculate overall progress
                    let overall_progress = base_progress_clone + (progress.percentage / 4);

                    self_clone
                        .update_progress_with_model(
                            "models",
                            overall_progress,
                            &format!("Downloading {}: {}%", model_clone, progress.percentage),
                            &format!("{:.1}MB/{:.1}MB", progress.current_mb, progress.total_mb),
                            Some(progress),
                        )
                        .await;
                }
            }
        });

        // Check if we're using native Ollama
        let is_native = self.is_ollama_already_running().await;
        
        // Execute ollama pull with streaming output
        let mut child = if is_native {
            // For native Ollama, run the command directly
            Command::new("ollama")
                .args(["pull", model])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| {
                    BackendError::Container(format!("Failed to start ollama pull: {}", e))
                })?
        } else {
            // For containerized Ollama, use exec
            match &self.runtime {
                ContainerRuntime::Podman(_) => Command::new("podman")
                    .args(["exec", "eliza-ollama", "ollama", "pull", model])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to start ollama pull: {}", e))
                    })?,
                ContainerRuntime::Docker(_) => Command::new("docker")
                    .args(["exec", "eliza-ollama", "ollama", "pull", model])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to start ollama pull: {}", e))
                    })?,
            }
        };

        // Get stdout for progress parsing
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| BackendError::Container("Failed to capture stdout".to_string()))?;

        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        // Stream and parse progress
        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break; // EOF
            }

            let trimmed_line = line.trim();
            if !trimmed_line.is_empty() {
                debug!("Ollama output: {}", trimmed_line);

                // Try to parse progress from this line
                if let Some(model_progress) = self.parse_ollama_progress(model, trimmed_line) {
                    // Calculate overall progress (base_progress + model progress within 25% range)
                    let overall_progress = base_progress + (model_progress.percentage / 4); // 25% range per model

                    self.update_progress_with_model(
                        "models",
                        overall_progress,
                        &format!("Downloading {}: {}%", model, model_progress.percentage),
                        &format!(
                            "{:.1}MB/{:.1}MB at {:.1}MB/s (ETA: {}s)",
                            model_progress.current_mb,
                            model_progress.total_mb,
                            model_progress.speed_mbps,
                            model_progress.eta_seconds
                        ),
                        Some(model_progress),
                    )
                    .await;
                }
            }
            line.clear();
        }

        // Wait for the process to complete
        let exit_status = child.wait().await.map_err(|e| {
            BackendError::Container(format!("Failed to wait for ollama pull: {}", e))
        })?;

        // Cancel the progress task
        progress_task.abort();

        if !exit_status.success() {
            return Err(BackendError::Container(format!(
                "Ollama pull failed for model {}",
                model
            )));
        }

        Ok(())
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

        // Determine which agent image to use or build
        let (image_name, image_exists) = match &self.runtime {
            ContainerRuntime::Podman(client) => {
                if client
                    .image_exists("eliza-agent-server:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent-server:latest".to_string(), true)
                } else if client
                    .image_exists("eliza-agent-working:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent-working:latest".to_string(), true)
                } else if client
                    .image_exists("eliza-agent:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent:latest".to_string(), true)
                } else {
                    ("eliza-agent-server:latest".to_string(), false)
                }
            }
            ContainerRuntime::Docker(client) => {
                if client
                    .image_exists("eliza-agent-server:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent-server:latest".to_string(), true)
                } else if client
                    .image_exists("eliza-agent-working:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent-working:latest".to_string(), true)
                } else if client
                    .image_exists("eliza-agent:latest")
                    .await
                    .unwrap_or(false)
                {
                    ("eliza-agent:latest".to_string(), true)
                } else {
                    ("eliza-agent-server:latest".to_string(), false)
                }
            }
        };

        if !image_exists {
            warn!("ElizaOS Agent image '{}' not found", image_name);
            return Err(BackendError::Container(
                "Agent container image not found. Please build the image first with: cd packages/agentserver && bun run build:binary linux && podman build -f Dockerfile.standalone -t eliza-agent-server:latest .".to_string()
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
            "DATABASE_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza"
                .to_string(),
            "POSTGRES_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza"
                .to_string(),
            "POSTGRES_HOST=eliza-postgres".to_string(),
            "POSTGRES_PORT=5432".to_string(),
            "POSTGRES_DB=eliza".to_string(),
            "POSTGRES_USER=eliza".to_string(),
            "POSTGRES_PASSWORD=eliza_secure_pass".to_string(),
            // Ollama connection - connects to eliza-ollama container via container network
            "OLLAMA_URL=http://eliza-ollama:11434".to_string(),
            "OLLAMA_SERVER_URL=http://eliza-ollama:11434".to_string(),
            "OLLAMA_BASE_URL=http://eliza-ollama:11434".to_string(),
            // Model configuration - use Ollama for local development
            "MODEL_PROVIDER=ollama".to_string(),
            "TEXT_PROVIDER=ollama".to_string(),
            "EMBEDDING_PROVIDER=ollama".to_string(),
            "TEXT_EMBEDDING_MODEL=nomic-embed-text".to_string(),
            "LANGUAGE_MODEL=llama3.2:3b".to_string(),
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
            "AUTO_SEND_TEST_MESSAGE",
        ];

        for var_name in env_vars_to_pass {
            if let Ok(value) = std::env::var(var_name) {
                info!(
                    "🚀 Passing {}={} to agent container",
                    var_name,
                    if var_name.contains("KEY") || var_name.contains("SECRET") {
                        "[REDACTED]"
                    } else {
                        &value
                    }
                );
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
            network: Some("eliza-network".to_string()),
            memory_limit: Some("4g".to_string()), // 4GB for agent container
        };

        let status = self.start_container(config).await?;
        
        // Start streaming container logs to the Tauri app logs
        info!("🔍 Starting log streaming for eliza-agent container");
        if let Err(e) = self.stream_container_logs("eliza-agent").await {
            warn!("⚠️ Failed to start log streaming for eliza-agent: {}", e);
            // Don't fail the container start if log streaming fails
        }
        
        Ok(status)
    }

    /// Waits for a container to become healthy with retry logic
    pub async fn wait_for_container_health(
        &self,
        container_name: &str,
        timeout: Duration,
    ) -> BackendResult<()> {
        use crate::container::retry::{retry_with_backoff, RetryConfig};
        use std::time::Instant;
        
        info!("⏳ Waiting for container {} to become healthy...", container_name);

        let start_time = Instant::now();
        
        // Configure retry for health checks
        let health_config = RetryConfig {
            max_attempts: 30, // 30 attempts over ~timeout duration
            initial_delay: Duration::from_secs(2),
            backoff_factor: 1.0, // Linear backoff for health checks
            max_delay: Duration::from_secs(5),
            jitter: true,
        };

        retry_with_backoff(
            &format!("{} health check", container_name),
            health_config,
            || async {
                // Check if we've exceeded timeout
                if start_time.elapsed() > timeout {
                    return Err(BackendError::Container(format!(
                        "Container {} failed to become healthy within {:?}",
                        container_name, timeout
                    )));
                }

                // Get container status
                let status = self.get_runtime_container_status(container_name).await?;

                match status.health {
                    HealthStatus::Healthy => {
                        info!("✅ Container {} is healthy", container_name);
                        Ok(())
                    }
                    HealthStatus::Unhealthy => {
                        // Container is unhealthy, this might be permanent
                        Err(BackendError::Container(format!(
                            "Container {} is unhealthy",
                            container_name
                        )))
                    }
                    HealthStatus::Starting | HealthStatus::Unknown => {
                        // Still starting, retry
                        Err(BackendError::Container(format!(
                            "Container {} is still starting (health: {:?})",
                            container_name, status.health
                        )))
                    }
                }
            },
        )
        .await
    }

    /// Start containers with proper dependencies and health checks
    pub async fn start_containers_with_dependencies(&self) -> BackendResult<()> {
        info!("🚀 Starting containers with dependency management...");

        // First, ensure network exists
        self.update_progress(
            "network",
            10,
            "Creating container network...",
            "Setting up eliza-network for inter-container communication",
        )
        .await;

        match &self.runtime {
            ContainerRuntime::Podman(client) => client.create_network("eliza-network").await?,
            ContainerRuntime::Docker(client) => client.create_network("eliza-network").await?,
        }

        // Start PostgreSQL first (no dependencies)
        self.update_progress(
            "postgres",
            20,
            "Starting PostgreSQL database...",
            "Initializing database container",
        )
        .await;

        match self.start_postgres().await {
            Ok(_) => {
                // Wait for PostgreSQL to be healthy
                if let Err(e) = self.wait_for_container_health("eliza-postgres", Duration::from_secs(60)).await {
                    error!("PostgreSQL failed health check: {}", e);
                    return Err(e);
                }
            }
            Err(e) if is_retryable_error(&e) => {
                // Try to recover and retry
                self.handle_podman_connection_error(&e).await?;
                self.start_postgres().await?;
                self.wait_for_container_health("eliza-postgres", Duration::from_secs(60)).await?;
            }
            Err(e) => return Err(e),
        }

        // Start Ollama in parallel with PostgreSQL health check
        self.update_progress(
            "ollama",
            40,
            "Starting Ollama AI service...",
            "Initializing local AI model server",
        )
        .await;

        match self.start_ollama().await {
            Ok(status) => {
                // Check if we're using native Ollama
                if status.name == "ollama-native" {
                    info!("Using native Ollama instance, skipping container health check");
                } else {
                    // Wait for Ollama container to be healthy
                    if let Err(e) = self.wait_for_container_health("eliza-ollama", Duration::from_secs(60)).await {
                        error!("Ollama container failed health check: {}", e);
                        return Err(e);
                    }
                }
            }
            Err(e) if is_retryable_error(&e) => {
                // Try to recover and retry
                self.handle_podman_connection_error(&e).await?;
                self.start_ollama().await?;
                self.wait_for_container_health("eliza-ollama", Duration::from_secs(60)).await?;
            }
            Err(e) => return Err(e),
        }

        // Pull Ollama models after Ollama is healthy
        self.update_progress(
            "models",
            60,
            "Downloading AI models...",
            "Pulling required models for agent operation",
        )
        .await;

        if let Err(e) = self.pull_ollama_models().await {
            error!("Failed to pull Ollama models: {}", e);
            return Err(e);
        }

        // Start agent after both PostgreSQL and Ollama are ready
        self.update_progress(
            "agent",
            80,
            "Starting ElizaOS Agent...",
            "Initializing conversational AI agent",
        )
        .await;

        match self.start_agent().await {
            Ok(_) => {
                // Wait for agent to be healthy
                if let Err(e) = self.wait_for_container_health("eliza-agent", Duration::from_secs(120)).await {
                    error!("Agent failed health check: {}", e);
                    return Err(e);
                }
            }
            Err(e) if is_retryable_error(&e) => {
                // Try to recover and retry
                self.handle_podman_connection_error(&e).await?;
                self.start_agent().await?;
                self.wait_for_container_health("eliza-agent", Duration::from_secs(120)).await?;
            }
            Err(e) => return Err(e),
        }

        self.update_progress(
            "complete",
            100,
            "All containers started successfully!",
            "ElizaOS is ready to use",
        )
        .await;

        Ok(())
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
                    info!(
                        "Container {} is already running, reusing it",
                        container_name
                    );

                    // Add the existing container to our tracking
                    let container_info = ContainerInfo {
                        id: existing_status.id.clone(),
                        config: config.clone(),
                        status: existing_status.clone(),
                    };
                    self.containers
                        .insert(container_name.clone(), container_info);

                    return Ok(existing_status);
                }
                ContainerState::Stopped => {
                    info!(
                        "Container {} exists but is stopped, restarting it",
                        container_name
                    );
                    // Just start the existing container instead of recreating
                    match &self.runtime {
                        ContainerRuntime::Podman(client) => {
                            if let Err(e) = client.start_existing_container(&container_name).await {
                                info!("Failed to restart existing container, removing and recreating: {}", e);
                                let _ = self.stop_container(&container_name).await;
                                let _ = self.remove_container(&container_name).await;
                            } else {
                                // Get the runtime status and add to tracking
                                let runtime_status =
                                    self.get_runtime_container_status(&container_name).await?;
                                let container_info = ContainerInfo {
                                    id: runtime_status.id.clone(),
                                    config: config.clone(),
                                    status: runtime_status.clone(),
                                };
                                self.containers
                                    .insert(container_name.clone(), container_info);
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
                    info!(
                        "Container {} exists in unknown state, removing and recreating",
                        container_name
                    );
                    let _ = self.stop_container(&container_name).await;
                    let _ = self.remove_container(&container_name).await;
                }
            }
        }

        // Start new container with Podman connection error recovery
        let container_id = match &self.runtime {
            ContainerRuntime::Podman(client) => {
                match client.start_container(&config).await {
                    Ok(id) => id,
                    Err(e) => {
                        // Check if this is a Podman connection error and try to recover
                        self.handle_podman_connection_error(&e).await?;
                        // Try once more after recovery
                        client.start_container(&config).await?
                    }
                }
            }
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

        self.containers
            .insert(container_name.clone(), container_info);

        // Start health monitoring if configured
        if let Some(health_check) = config.health_check {
            self.health_monitor
                .start_monitoring(
                    container_name.clone(),
                    health_check,
                    self.containers.clone(),
                )
                .await;
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
            return Err(BackendError::Container(format!(
                "Container {name} not found"
            )));
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
            Err(BackendError::Container(format!(
                "Container {name} not found"
            )))
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
            ContainerRuntime::Podman(client) => client.get_container_status(name).await,
            ContainerRuntime::Docker(client) => client.get_container_status(name).await,
        }
    }

    /// Gets the status of all managed containers.
    ///
    /// # Errors
    ///
    /// This function currently never returns an error but uses Result for consistency.
    pub async fn get_all_statuses(&self) -> BackendResult<Vec<ContainerStatus>> {
        let statuses: Vec<ContainerStatus> = self
            .containers
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

        let container_names: Vec<String> = self
            .containers
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
    pub async fn setup_complete_environment(
        &self,
        resource_dir: &std::path::Path,
    ) -> BackendResult<()> {
        self.update_progress(
            "checking",
            0,
            "Checking container runtime...",
            "Verifying runtime availability",
        )
        .await;

        // Check runtime availability
        let available = match &self.runtime {
            ContainerRuntime::Podman(client) => client.is_available().await?,
            ContainerRuntime::Docker(client) => client.is_available().await?,
        };

        if !available {
            return Err(BackendError::Container(
                "Container runtime not available".to_string(),
            ));
        }

        self.update_progress(
            "network",
            10,
            "Creating container network...",
            "Setting up eliza-network for inter-container communication",
        )
        .await;

        // Create the eliza network for container communication
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.create_network("eliza-network").await?,
            ContainerRuntime::Docker(client) => client.create_network("eliza-network").await?,
        }

        self.update_progress(
            "installing",
            20,
            "Loading container images...",
            "Loading PostgreSQL and Ollama images",
        )
        .await;

        // Load bundled images if they exist
        self.load_bundled_images(resource_dir).await?;

        self.update_progress(
            "starting",
            50,
            "Starting PostgreSQL...",
            "Initializing database container",
        )
        .await;
        self.start_postgres().await?;

        self.update_progress(
            "starting",
            60,
            "Starting Ollama...",
            "Initializing AI model container",
        )
        .await;
        self.start_ollama().await?;

        self.update_progress(
            "models",
            65,
            "Downloading AI models...",
            "Pulling required models for agent operation",
        )
        .await;
        self.pull_ollama_models().await?;

        self.update_progress(
            "starting",
            80,
            "Starting ElizaOS Agent...",
            "Initializing conversational AI agent",
        )
        .await;
        self.start_agent().await?;

        self.update_progress(
            "complete",
            100,
            "Setup complete!",
            "All containers are running",
        )
        .await;

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

        // Clone the progress to emit
        let progress_to_emit = progress_guard.clone();
        drop(progress_guard);

        // Emit setup progress event to frontend
        if let Some(ref app_handle) = self.app_handle {
            if let Err(e) = app_handle.emit("setup-progress", &progress_to_emit) {
                error!("Failed to emit setup progress: {}", e);
            }
        }
    }

    async fn update_progress_with_model(
        &self,
        stage: &str,
        progress: u8,
        message: &str,
        details: &str,
        model_progress: Option<ModelDownloadProgress>,
    ) {
        let mut progress_guard = self.setup_progress.write().await;
        progress_guard.stage = stage.to_string();
        progress_guard.progress = progress;
        progress_guard.message = message.to_string();
        progress_guard.details = details.to_string();
        progress_guard.can_retry = matches!(stage, "error");
        progress_guard.model_progress = model_progress;

        if let Some(ref model) = progress_guard.model_progress {
            info!(
                "Setup progress: {} - {} ({}%) | Model: {} {}% ({:.1}MB/{:.1}MB)",
                stage,
                message,
                progress,
                model.model_name,
                model.percentage,
                model.current_mb,
                model.total_mb
            );
        } else {
            info!("Setup progress: {} - {} ({}%)", stage, message, progress);
        }

        // Clone the progress to emit
        let progress_to_emit = progress_guard.clone();
        drop(progress_guard);

        // Emit setup progress event to frontend
        if let Some(ref app_handle) = self.app_handle {
            if let Err(e) = app_handle.emit("setup-progress", &progress_to_emit) {
                error!("Failed to emit setup progress: {}", e);
            }
        }
    }

    /// Parse Ollama pull progress from output line
    /// Expected format: "pulling dde5aa3fc5ff: 91% ████████████████ 1.8 GB/2.0 GB 1.4 MB/s 2m6s"
    fn parse_ollama_progress(&self, model_name: &str, line: &str) -> Option<ModelDownloadProgress> {
        debug!("Parsing Ollama line: {}", line);

        if !line.contains("pulling ") || !line.contains("%") {
            debug!("Line doesn't contain 'pulling' or '%', skipping");
            return None;
        }

        // Try to extract percentage
        let percentage = line
            .split('%')
            .next()?
            .split_whitespace()
            .last()?
            .parse::<u8>()
            .ok()?;
        debug!("Extracted percentage: {}%", percentage);

        // Try to extract size info like "1.8 GB/2.0 GB"
        let size_parts: Vec<&str> = line.split_whitespace().collect();
        debug!("Size parts: {:?}", size_parts);

        let mut current_mb = 0.0;
        let mut total_mb = 0.0;
        let mut speed_mbps = 0.0;
        let mut eta_seconds = 0;

        // Find size pattern "X.X GB/Y.Y GB"
        for i in 0..size_parts.len().saturating_sub(2) {
            // Check for patterns like "1.8 GB/2.0"
            if i + 2 < size_parts.len() && size_parts[i + 1].ends_with("/") {
                if let Ok(current) = size_parts[i].parse::<f64>() {
                    current_mb = current * 1024.0; // Convert GB to MB
                    debug!("Found current size: {} GB = {} MB", current, current_mb);
                }
                if let Ok(total) = size_parts[i + 2].parse::<f64>() {
                    total_mb = total * 1024.0; // Convert GB to MB
                    debug!("Found total size: {} GB = {} MB", total, total_mb);
                }
            }
            // Check for patterns like "1.8GB/2.0GB"
            else if size_parts[i].contains("GB/") {
                let parts: Vec<&str> = size_parts[i].split('/').collect();
                if parts.len() == 2 {
                    if let Ok(current) = parts[0].replace("GB", "").parse::<f64>() {
                        current_mb = current * 1024.0;
                        debug!("Found current size: {} GB = {} MB", current, current_mb);
                    }
                    if let Ok(total) = parts[1].replace("GB", "").parse::<f64>() {
                        total_mb = total * 1024.0;
                        debug!("Found total size: {} GB = {} MB", total, total_mb);
                    }
                }
            }
        }

        // Find speed pattern "X.X MB/s" or "X.XMB/s"
        for i in 0..size_parts.len() {
            if size_parts[i].ends_with("MB/s") {
                if let Ok(speed) = size_parts[i].replace("MB/s", "").parse::<f64>() {
                    speed_mbps = speed;
                    debug!("Found speed: {} MB/s", speed_mbps);
                }
            } else if i + 1 < size_parts.len() && size_parts[i + 1] == "MB/s" {
                if let Ok(speed) = size_parts[i].parse::<f64>() {
                    speed_mbps = speed;
                    debug!("Found speed: {} MB/s", speed_mbps);
                }
            }
        }

        // Find ETA pattern "XmYs"
        for part in &size_parts {
            if part.contains('m') && part.contains('s') {
                if let Some(min_str) = part.split('m').next() {
                    if let Some(sec_str) = part.split('m').nth(1)?.strip_suffix('s') {
                        if let (Ok(minutes), Ok(seconds)) =
                            (min_str.parse::<u32>(), sec_str.parse::<u32>())
                        {
                            eta_seconds = minutes * 60 + seconds;
                            debug!(
                                "Found ETA: {}m{}s = {} seconds",
                                minutes, seconds, eta_seconds
                            );
                        }
                    }
                }
            }
        }

        let progress = Some(ModelDownloadProgress {
            model_name: model_name.to_string(),
            current_mb,
            total_mb,
            percentage,
            speed_mbps,
            eta_seconds,
            status: if percentage >= 100 {
                ModelDownloadStatus::Completed
            } else {
                ModelDownloadStatus::Downloading
            },
        });

        debug!("Parsed progress: {:?}", progress);
        progress
    }

    /// Stream container logs to console
    pub async fn stream_container_logs(&self, container_name: &str) -> BackendResult<()> {
        info!("Starting log streaming for container: {}", container_name);
        
        // Stop any existing log streaming for this container
        self.log_streamer.stop_streaming(container_name).await;
        
        // Verify container exists
        if !self.container_exists(container_name).await? {
            return Err(BackendError::Container(format!(
                "Container '{}' does not exist",
                container_name
            )));
        }
        
        let runtime_clone = self.runtime.clone();
        let container_name_str = container_name.to_string();
        let log_streamer = self.log_streamer.clone();
        let container_name_for_storage = container_name.to_string();
        let app_handle_clone = self.app_handle.clone();
        
        // Spawn the main log streaming task
        let handle = tokio::spawn(async move {
            let mut first_iteration = true;
            
            loop {
                info!("Starting/restarting log stream for container: {}", container_name_str);
                
                let result = match &runtime_clone {
                    ContainerRuntime::Podman(_client) => {
                        Self::stream_logs_podman_with_recovery(&container_name_str, app_handle_clone.as_ref()).await
                    }
                    ContainerRuntime::Docker(_client) => {
                        Self::stream_logs_docker_with_recovery(&container_name_str, app_handle_clone.as_ref()).await
                    }
                };
                
                match result {
                    Ok(child_handle) => {
                        // For now, we just wait for the child process
                        if let Err(e) = child_handle.await {
                            error!("Log streaming task error for {}: {}", container_name_str, e);
                        }
                    }
                    Err(e) => {
                        error!("Failed to stream logs for {}: {}", container_name_str, e);
                        
                        // On first iteration failure, break to avoid infinite loop
                        if first_iteration {
                            break;
                        }
                    }
                }
                
                first_iteration = false;
                
                // Check if we should stop (container removed or stopped)
                if !Self::should_continue_streaming(&runtime_clone, &container_name_str).await {
                    info!("Container {} no longer exists or is stopped, ending log stream", container_name_str);
                    break;
                }
                
                // Wait a bit before retrying
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
            
            // Clean up when done
            log_streamer.streams.remove(&container_name_str);
        });
        
        // For the child handle in LogStreamTask, we'll use a dummy handle
        // The actual child process is managed inside the main task
        let child_handle = tokio::spawn(async {});
        
        // Store the task
        self.log_streamer.streams.insert(
            container_name_for_storage,
            LogStreamTask {
                handle,
                child_handle,
            },
        );
        
        Ok(())
    }
    
    async fn should_continue_streaming(runtime: &ContainerRuntime, container_name: &str) -> bool {
        match runtime {
            ContainerRuntime::Podman(client) => {
                client.is_container_running(container_name).await.unwrap_or(false)
            }
            ContainerRuntime::Docker(client) => {
                client.is_container_running(container_name).await.unwrap_or(false)
            }
        }
    }
    
    async fn stream_logs_podman_with_recovery(container_name: &str, app_handle: Option<&AppHandle>) -> BackendResult<JoinHandle<()>> {
        use tokio::process::Command;
        use tokio::io::{AsyncBufReadExt, BufReader};
        use chrono::Local;
        
        let mut child = Command::new("podman")
            .args(["logs", "-f", "--timestamps", container_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)  // Ensure process is killed if we drop it
            .spawn()
            .map_err(|e| BackendError::Container(format!("Failed to start log streaming: {}", e)))?;
            
        let container_name_stdout = container_name.to_string();
        let container_name_stderr = container_name.to_string();
        let container_name_handle = container_name.to_string();
        let app_handle_stdout = app_handle.cloned();
        let app_handle_stderr = app_handle.cloned();
        
        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            
            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse podman timestamp format if present, otherwise add our own
                    let formatted_line = if line.starts_with("20") && line.len() > 30 {
                        // Line likely has podman timestamp, use as-is
                        line.clone()
                    } else {
                        // Add our own timestamp
                        format!("{} {}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), line)
                    };
                    info!("[{}] {}", container_name_stdout, formatted_line);
                    
                    // Emit to frontend if app_handle is available
                    if let Some(app_handle) = &app_handle_stdout {
                        let _ = app_handle.emit("container-log", serde_json::json!({
                            "container": container_name_stdout.clone(),
                            "message": formatted_line,
                            "stream": "stdout",
                            "timestamp": Local::now().timestamp_millis()
                        }));
                    }
                }
                debug!("Stdout stream ended for container: {}", container_name_stdout);
            });
        }
        
        // Stream stderr
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse timestamp or add our own
                    let formatted_line = if line.starts_with("20") && line.len() > 30 {
                        line.clone()
                    } else {
                        format!("{} {}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), line)
                    };
                    error!("[{}] {}", container_name_stderr, formatted_line);
                    
                    // Emit to frontend if app_handle is available
                    if let Some(app_handle) = &app_handle_stderr {
                        let _ = app_handle.emit("container-log", serde_json::json!({
                            "container": container_name_stderr.clone(),
                            "message": formatted_line,
                            "stream": "stderr",
                            "timestamp": Local::now().timestamp_millis()
                        }));
                    }
                }
                debug!("Stderr stream ended for container: {}", container_name_stderr);
            });
        }
        
        // Return a handle that waits for the child process
        Ok(tokio::spawn(async move {
            match child.wait().await {
                Ok(status) => {
                    if !status.success() {
                        warn!("Log streaming process exited with status: {} for container: {}", 
                              status, container_name_handle);
                    } else {
                        debug!("Log streaming process ended normally for container: {}", 
                               container_name_handle);
                    }
                }
                Err(e) => {
                    error!("Failed to wait for log streaming process: {} for container: {}", 
                           e, container_name_handle);
                }
            }
        }))
    }
    
    async fn stream_logs_docker_with_recovery(container_name: &str, app_handle: Option<&AppHandle>) -> BackendResult<JoinHandle<()>> {
        use tokio::process::Command;
        use tokio::io::{AsyncBufReadExt, BufReader};
        use chrono::Local;
        
        let mut child = Command::new("docker")
            .args(["logs", "-f", "--timestamps", container_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)  // Ensure process is killed if we drop it
            .spawn()
            .map_err(|e| BackendError::Container(format!("Failed to start log streaming: {}", e)))?;
            
        let container_name_stdout = container_name.to_string();
        let container_name_stderr = container_name.to_string();
        let container_name_handle = container_name.to_string();
        let app_handle_stdout = app_handle.cloned();
        let app_handle_stderr = app_handle.cloned();
        
        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            
            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse docker timestamp format if present, otherwise add our own
                    let formatted_line = if line.starts_with("20") && line.len() > 30 {
                        // Line likely has docker timestamp, use as-is
                        line.clone()
                    } else {
                        // Add our own timestamp
                        format!("{} {}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), line)
                    };
                    info!("[{}] {}", container_name_stdout, formatted_line);
                    
                    // Emit to frontend if app_handle is available
                    if let Some(app_handle) = &app_handle_stdout {
                        let _ = app_handle.emit("container-log", serde_json::json!({
                            "container": container_name_stdout.clone(),
                            "message": formatted_line,
                            "stream": "stdout",
                            "timestamp": Local::now().timestamp_millis()
                        }));
                    }
                }
                debug!("Stdout stream ended for container: {}", container_name_stdout);
            });
        }
        
        // Stream stderr  
        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            
            tokio::spawn(async move {
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse timestamp or add our own
                    let formatted_line = if line.starts_with("20") && line.len() > 30 {
                        line.clone()
                    } else {
                        format!("{} {}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), line)
                    };
                    error!("[{}] {}", container_name_stderr, formatted_line);
                    
                    // Emit to frontend if app_handle is available
                    if let Some(app_handle) = &app_handle_stderr {
                        let _ = app_handle.emit("container-log", serde_json::json!({
                            "container": container_name_stderr.clone(),
                            "message": formatted_line,
                            "stream": "stderr",
                            "timestamp": Local::now().timestamp_millis()
                        }));
                    }
                }
                debug!("Stderr stream ended for container: {}", container_name_stderr);
            });
        }
        
        // Return a handle that waits for the child process
        Ok(tokio::spawn(async move {
            match child.wait().await {
                Ok(status) => {
                    if !status.success() {
                        warn!("Log streaming process exited with status: {} for container: {}", 
                              status, container_name_handle);
                    } else {
                        debug!("Log streaming process ended normally for container: {}", 
                               container_name_handle);
                    }
                }
                Err(e) => {
                    error!("Failed to wait for log streaming process: {} for container: {}", 
                           e, container_name_handle);
                }
            }
        }))
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
                    .map_err(|e| {
                        BackendError::Container(format!("Failed to create init volume: {e}"))
                    })?;

                if !output.status.success() {
                    let error = String::from_utf8_lossy(&output.stderr);
                    // Ignore "already exists" errors
                    if !error.contains("already exists") {
                        warn!("Could not create init volume: {}", error);
                    }
                }
                
                // Copy init scripts to the volume
                // Try multiple locations for init scripts
                let possible_script_dirs = if let Some(resource_dir) = &self.resource_dir {
                    vec![
                        resource_dir.join("init-scripts"), // Bundled resources
                        resource_dir.parent().unwrap_or(resource_dir).join("init-scripts"), // Resource parent
                        std::path::PathBuf::from("init-scripts"), // Current directory
                        std::path::PathBuf::from("../init-scripts"), // Parent directory (development)
                    ]
                } else {
                    vec![
                        std::path::PathBuf::from("init-scripts"),
                        std::path::PathBuf::from("../init-scripts"),
                    ]
                };
                
                let mut init_scripts_found = false;
                for init_scripts_dir in &possible_script_dirs {
                    if init_scripts_dir.exists() {
                        info!("Found PostgreSQL init scripts at: {}", init_scripts_dir.display());
                        init_scripts_found = true;
                        
                        // Get volume mount point
                        let inspect_output = std::process::Command::new("podman")
                            .args(["volume", "inspect", "eliza-postgres-init", "--format", "{{.Mountpoint}}"])
                            .output()
                            .map_err(|e| {
                                BackendError::Container(format!("Failed to inspect init volume: {e}"))
                            })?;
                        
                        if inspect_output.status.success() {
                            let mount_point = String::from_utf8_lossy(&inspect_output.stdout).trim().to_string();
                            
                            // Copy all SQL files to the volume
                            for entry in std::fs::read_dir(init_scripts_dir)? {
                                let entry = entry?;
                                let path = entry.path();
                                if path.extension().and_then(|s| s.to_str()) == Some("sql") {
                                    let file_name = path.file_name().unwrap();
                                    let _dest_path = std::path::Path::new(&mount_point).join(file_name);
                                    
                                    // For macOS compatibility, use a temporary container to copy files
                                    // First, create a temp container
                                    let temp_container = format!("temp-init-copy-{}", uuid::Uuid::new_v4());
                                    let create_output = std::process::Command::new("podman")
                                        .args(["create", "--name", &temp_container, "-v", "eliza-postgres-init:/init", "busybox"])
                                        .output()
                                        .map_err(|e| {
                                            BackendError::Container(format!("Failed to create temp container: {e}"))
                                        })?;
                                    
                                    if create_output.status.success() {
                                        // Copy file to container
                                        let cp_output = std::process::Command::new("podman")
                                            .args(["cp", path.to_str().unwrap(), &format!("{}:/init/{}", temp_container, file_name.to_string_lossy())])
                                            .output()
                                            .map_err(|e| {
                                                BackendError::Container(format!("Failed to copy init script: {e}"))
                                            })?;
                                        
                                        if !cp_output.status.success() {
                                            warn!("Failed to copy {}: {}", path.display(), String::from_utf8_lossy(&cp_output.stderr));
                                        } else {
                                            info!("Copied init script: {}", file_name.to_string_lossy());
                                        }
                                        
                                        // Clean up temp container
                                        let _ = std::process::Command::new("podman")
                                            .args(["rm", &temp_container])
                                            .output();
                                    } else {
                                        warn!("Failed to create temp container: {}", String::from_utf8_lossy(&create_output.stderr));
                                    }
                                }
                            }
                        } else {
                            warn!("Could not get volume mount point: {}", String::from_utf8_lossy(&inspect_output.stderr));
                        }
                        break; // Found and processed scripts, stop looking
                    }
                }
                
                if !init_scripts_found {
                    warn!("No init-scripts directory found in any of the expected locations");
                    debug!("Searched locations: {:?}", possible_script_dirs);
                }
            }
            ContainerRuntime::Docker(_client) => {
                // Similar for Docker if needed
            }
        }

        Ok(())
    }

    /// Checks if Ollama is already running on port 11434
    async fn is_ollama_already_running(&self) -> bool {
        info!("🔍 Checking if Ollama is already running on port 11434...");
        
        // Try to connect to Ollama API
        match tokio::process::Command::new("curl")
            .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:11434/api/tags"])
            .output()
            .await
        {
            Ok(output) => {
                let status_code = String::from_utf8_lossy(&output.stdout);
                if status_code.trim() == "200" {
                    info!("✅ Ollama is already running and responding on port 11434");
                    return true;
                }
            }
            Err(_) => {
                // curl might not be available, try alternative check
            }
        }
        
        // Alternative: Check if port is in use
        match std::process::Command::new("lsof")
            .args(["-ti:11434"])
            .output()
        {
            Ok(output) => {
                let pids = String::from_utf8_lossy(&output.stdout);
                if !pids.trim().is_empty() {
                    info!("🔍 Port 11434 is in use, checking if it's Ollama...");
                    
                    // Try a simple health check
                    match tokio::process::Command::new("nc")
                        .args(["-z", "localhost", "11434"])
                        .output()
                        .await
                    {
                        Ok(output) => {
                            if output.status.success() {
                                info!("✅ Port 11434 is responding, assuming Ollama is running");
                                return true;
                            }
                        }
                        Err(_) => {}
                    }
                }
            }
            Err(_) => {}
        }
        
        info!("❌ No Ollama instance found on port 11434");
        false
    }

    /// Check if Podman is running and attempt to restart if needed
    pub async fn ensure_podman_running(&self) -> BackendResult<()> {
        // Acquire the mutex to prevent concurrent restart attempts
        let _lock = self.podman_restart_mutex.lock().await;
        
        info!("🔍 Checking Podman machine status...");

        // First, do a quick health check
        let health_check = tokio::process::Command::new("podman")
            .args(["info", "--format", "{{.Host.Arch}}"])
            .output()
            .await;

        if let Ok(output) = health_check {
            if output.status.success() {
                info!("✅ Podman is running and healthy");
                return Ok(());
            }
        }

        // If health check failed, check machine status
        let machine_status = tokio::process::Command::new("podman")
            .args(["machine", "list", "--format", "{{.Name}},{{.Running}}"])
            .output()
            .await;

        let needs_start = match machine_status {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stdout);
                // Check if any machine exists and is running
                !output_str.lines().any(|line| line.contains("true"))
            }
            Err(e) => {
                warn!("Failed to check Podman machine status: {}", e);
                true // Assume we need to start if we can't check
            }
        };

        if needs_start {
            info!("🚀 Starting Podman machine...");
            
            // Try to start the machine
            let start_result = tokio::process::Command::new("podman")
                .args(["machine", "start"])
                .output()
                .await;

            match start_result {
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    
                    // Check if it's already running (not an error)
                    if output.status.success() || stderr.contains("already running") {
                        info!("✅ Podman machine is now running");
                        
                        // Wait for it to be fully ready
                        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                        
                        // Emit success event
                        if let Some(app_handle) = &self.app_handle {
                            let _ = app_handle.emit(
                                "podman-ready",
                                "Podman machine is ready",
                            );
                        }
                        
                        return Ok(());
                    } else {
                        error!("❌ Failed to start Podman machine: {}", stderr);
                        return Err(BackendError::Container(format!(
                            "Failed to start Podman machine: {}",
                            stderr
                        )));
                    }
                }
                Err(e) => {
                    error!("❌ Error running podman machine start: {}", e);
                    return Err(BackendError::Container(format!(
                        "Error starting Podman machine: {}",
                        e
                    )));
                }
            }
        }

        // Machine was already running, do one final health check
        let final_health = tokio::process::Command::new("podman")
            .args(["info", "--format", "{{.Host.Arch}}"])
            .output()
            .await;

        match final_health {
            Ok(output) => {
                if output.status.success() {
                    info!("✅ Podman is healthy and ready");
                    Ok(())
                } else {
                    warn!("⚠️ Podman machine is running but not responding properly");
                    // Don't try to restart here to avoid loops
                    Ok(())
                }
            }
            Err(e) => {
                warn!("⚠️ Final health check failed: {}", e);
                // Still return Ok to avoid cascading failures
                Ok(())
            }
        }
    }

    /// Monitor Podman health continuously and restart if needed
    pub async fn start_podman_health_monitor(&self) {
        let manager_clone = self.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // Check every minute

            loop {
                interval.tick().await;

                if let Err(e) = manager_clone.ensure_podman_running().await {
                    error!("Podman health monitor error: {}", e);
                }
            }
        });
    }

    /// Stop all background services (health monitoring and log streaming)
    pub async fn stop_all(&self) {
        info!("Stopping all container manager background services");
        
        // Stop all health monitoring
        self.health_monitor.stop_all_monitoring().await;
        
        // Stop all log streaming
        self.log_streamer.stop_all_streaming().await;
        
        info!("All container manager background services stopped");
    }

    /// Check if a container exists
    pub async fn container_exists(&self, container_name: &str) -> BackendResult<bool> {
        match &self.runtime {
            ContainerRuntime::Podman(client) => client.container_exists(container_name).await,
            ContainerRuntime::Docker(client) => client.container_exists(container_name).await,
        }
    }
}

impl Clone for ContainerManager {
    fn clone(&self) -> Self {
        Self {
            runtime: match &self.runtime {
                ContainerRuntime::Podman(client) => ContainerRuntime::Podman(client.clone()),
                ContainerRuntime::Docker(client) => ContainerRuntime::Docker(client.clone()),
            },
            containers: self.containers.clone(),
            health_monitor: self.health_monitor.clone(),
            log_streamer: self.log_streamer.clone(),
            setup_progress: self.setup_progress.clone(),
            app_handle: self.app_handle.clone(),
            resource_dir: self.resource_dir.clone(),
            podman_restart_mutex: self.podman_restart_mutex.clone(),
        }
    }
}

// Re-export the health monitor
pub use super::health::HealthMonitor;
