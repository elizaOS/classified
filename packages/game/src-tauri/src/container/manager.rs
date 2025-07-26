use crate::backend::{
    BackendError, BackendResult, ContainerConfig, ContainerState, ContainerStatus,
    HealthCheckConfig, HealthStatus, ModelDownloadProgress, ModelDownloadStatus, PortMapping,
    SetupProgress, VolumeMount,
};
use dashmap::DashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

pub struct ContainerManager {
    runtime: ContainerRuntime,
    containers: Arc<DashMap<String, ContainerInfo>>,
    health_monitor: Arc<HealthMonitor>,
    setup_progress: Arc<RwLock<SetupProgress>>,
    app_handle: Option<AppHandle>,
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
                model_progress: None,
            })),
            app_handle: None,
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
        let mut runtime_manager = super::RuntimeManager::new(resource_dir);

        match runtime_manager.initialize().await {
            Ok(runtime_type) => {
                let (runtime, runtime_name) = match runtime_type {
                    super::RuntimeType::Bundled(path)
                    | super::RuntimeType::System(path)
                    | super::RuntimeType::Downloaded(path) => {
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
                    setup_progress: Arc::new(RwLock::new(SetupProgress {
                        stage: "initialized".to_string(),
                        progress: 0,
                        message: format!("Container manager initialized with {runtime_name}"),
                        details: "Runtime detection and initialization completed".to_string(),
                        can_retry: false,
                        model_progress: None,
                    })),
                    app_handle: None,
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
            network: Some("eliza-network".to_string()),
            memory_limit: Some("2g".to_string()),
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

        // Kill any existing system Ollama processes to free up port 11434
        self.kill_existing_ollama_processes().await;

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

        self.start_container(config).await
    }

    /// Get current download progress from Ollama API
    #[allow(dead_code)]
    async fn get_ollama_download_progress(
        &self,
        model: &str,
    ) -> BackendResult<Option<ModelDownloadProgress>> {
        debug!("Getting download progress for model: {}", model);

        // Use curl inside the container to query Ollama API
        let output = match &self.runtime {
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

        let output = match &self.runtime {
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

    /// Handle Podman connection errors by attempting to restart the Podman machine
    async fn handle_podman_connection_error(&self, error: &BackendError) -> BackendResult<()> {
        let error_str = error.to_string();

        // Check if this is a Podman connection error
        if error_str.contains("unable to connect to Podman socket")
            || error_str.contains("Cannot connect to Podman")
            || error_str.contains("connection refused")
        {
            warn!("Podman connection error detected, attempting to restart Podman machine...");

            // Stop the Podman machine
            info!("Stopping Podman machine...");
            let stop_result = tokio::process::Command::new("podman")
                .args(["machine", "stop"])
                .output()
                .await;

            if let Err(e) = stop_result {
                error!("Failed to stop Podman machine: {}", e);
            } else {
                // Wait a moment for the machine to fully stop
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }

            // Start the Podman machine
            info!("Starting Podman machine...");
            let start_result = tokio::process::Command::new("podman")
                .args(["machine", "start"])
                .output()
                .await;

            match start_result {
                Ok(output) => {
                    if output.status.success() {
                        info!("✅ Podman machine restarted successfully");
                        // Wait for the machine to be fully ready
                        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                        return Ok(());
                    } else {
                        let error_msg = String::from_utf8_lossy(&output.stderr);
                        error!("Failed to start Podman machine: {}", error_msg);
                        return Err(BackendError::Container(format!(
                            "Failed to restart Podman machine: {}",
                            error_msg
                        )));
                    }
                }
                Err(e) => {
                    error!("Failed to start Podman machine: {}", e);
                    return Err(BackendError::Container(format!(
                        "Failed to restart Podman machine: {}",
                        e
                    )));
                }
            }
        }

        // Not a connection error, return the original error
        Err(BackendError::Container(error.to_string()))
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

        // Execute ollama pull with streaming output
        let mut child = match &self.runtime {
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
            "DATABASE_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game"
                .to_string(),
            "POSTGRES_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game"
                .to_string(),
            "POSTGRES_HOST=eliza-postgres".to_string(),
            "POSTGRES_PORT=5432".to_string(),
            "POSTGRES_DB=eliza_game".to_string(),
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
            }
            ContainerRuntime::Docker(_client) => {
                // Similar for Docker if needed
            }
        }

        Ok(())
    }

    /// Kills any existing system Ollama processes to free up port 11434
    async fn kill_existing_ollama_processes(&self) {
        info!("🔍 Checking for existing Ollama processes on port 11434...");

        // Find processes using port 11434
        let lsof_output = std::process::Command::new("lsof")
            .args(["-ti:11434"])
            .output();

        match lsof_output {
            Ok(output) => {
                let pids_str = String::from_utf8_lossy(&output.stdout);
                let pids: Vec<&str> = pids_str
                    .lines()
                    .filter(|line| !line.trim().is_empty())
                    .collect();

                if !pids.is_empty() {
                    info!(
                        "🚫 Found {} process(es) using port 11434: {:?}",
                        pids.len(),
                        pids
                    );

                    // Kill ALL processes, not just some
                    let mut killed_count = 0;
                    let mut failed_count = 0;

                    for pid in pids {
                        if let Ok(pid_num) = pid.trim().parse::<u32>() {
                            info!("🔪 Killing process with PID: {}", pid_num);

                            // Try graceful termination first
                            let kill_result = std::process::Command::new("kill")
                                .args(["-TERM", &pid_num.to_string()])
                                .output();

                            match kill_result {
                                Ok(result) => {
                                    if result.status.success() {
                                        info!(
                                            "✅ Successfully sent SIGTERM to process {}",
                                            pid_num
                                        );
                                        killed_count += 1;
                                    } else {
                                        // Process might already be gone, or permission denied
                                        let stderr = String::from_utf8_lossy(&result.stderr);
                                        if stderr.contains("No such process") {
                                            info!("Process {} already gone", pid_num);
                                        } else {
                                            warn!("Failed to kill process {}: {}", pid_num, stderr);
                                            failed_count += 1;
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!("Error killing process {}: {}", pid_num, e);
                                    failed_count += 1;
                                }
                            }
                        }
                    }

                    // Wait for graceful shutdown
                    if killed_count > 0 {
                        info!(
                            "Waiting for {} processes to terminate gracefully...",
                            killed_count
                        );
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    }

                    // Force kill any remaining processes
                    let pids_str = String::from_utf8_lossy(&output.stdout);
                    let pids: Vec<&str> = pids_str
                        .lines()
                        .filter(|line| !line.trim().is_empty())
                        .collect();

                    for pid in pids {
                        if let Ok(pid_num) = pid.trim().parse::<u32>() {
                            // Check if process is still running
                            let check_result = std::process::Command::new("kill")
                                .args(["-0", &pid_num.to_string()])
                                .output();

                            if let Ok(check) = check_result {
                                if check.status.success() {
                                    info!("⚡ Process {} still running, force killing...", pid_num);
                                    let force_result = std::process::Command::new("kill")
                                        .args(["-KILL", &pid_num.to_string()])
                                        .output();

                                    if let Ok(result) = force_result {
                                        if result.status.success() {
                                            info!("✅ Force killed process {}", pid_num);
                                        } else {
                                            error!(
                                                "❌ Failed to force kill process {}: {}",
                                                pid_num,
                                                String::from_utf8_lossy(&result.stderr)
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Final wait for processes to fully terminate
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                    // Verify port is now free
                    let verify_output = std::process::Command::new("lsof")
                        .args(["-ti:11434"])
                        .output();

                    if let Ok(output) = verify_output {
                        let remaining = String::from_utf8_lossy(&output.stdout);
                        if !remaining.trim().is_empty() {
                            error!("❌ Port 11434 still in use after cleanup attempt!");
                        } else {
                            info!("✅ Port 11434 is now free");
                        }
                    }

                    info!(
                        "✅ Finished cleaning up processes on port 11434 (killed: {}, failed: {})",
                        killed_count, failed_count
                    );
                } else {
                    info!("✅ No existing processes found on port 11434");
                }
            }
            Err(e) => {
                // lsof might not be available or permission denied, try alternative approach
                warn!(
                    "Could not use lsof to check port 11434: {}, trying alternative approach",
                    e
                );

                // Try to find Ollama processes by name
                let ps_output = std::process::Command::new("pgrep")
                    .args(["-f", "ollama"])
                    .output();

                match ps_output {
                    Ok(output) => {
                        let pids_str = String::from_utf8_lossy(&output.stdout);
                        let pids: Vec<&str> = pids_str
                            .lines()
                            .filter(|line| !line.trim().is_empty())
                            .collect();

                        if !pids.is_empty() {
                            info!("🚫 Found {} Ollama process(es): {:?}", pids.len(), pids);

                            for pid in pids {
                                if let Ok(pid_num) = pid.trim().parse::<u32>() {
                                    info!("🔪 Killing Ollama process with PID: {}", pid_num);
                                    let _ = std::process::Command::new("kill")
                                        .args(["-TERM", &pid_num.to_string()])
                                        .output();
                                }
                            }

                            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                            info!("✅ Finished cleaning up Ollama processes");
                        } else {
                            info!("✅ No existing Ollama processes found");
                        }
                    }
                    Err(_) => {
                        info!(
                            "ℹ️ Could not check for existing Ollama processes, proceeding anyway"
                        );
                    }
                }
            }
        }
    }

    /// Check if Podman is running and attempt to restart if needed
    pub async fn ensure_podman_running(&self) -> BackendResult<()> {
        info!("🔍 Checking Podman machine status...");

        // Check if podman machine is running
        let status_output = tokio::process::Command::new("podman")
            .args(["machine", "list", "--format", "{{.Running}}"])
            .output()
            .await;

        match status_output {
            Ok(output) => {
                let status_str = String::from_utf8_lossy(&output.stdout);
                let is_running = status_str.trim().contains("true");

                if !is_running {
                    warn!("⚠️ Podman machine is not running, attempting to start...");

                    // Try to start podman machine
                    let start_result = tokio::process::Command::new("podman")
                        .args(["machine", "start"])
                        .output()
                        .await;

                    match start_result {
                        Ok(start_output) => {
                            if start_output.status.success() {
                                info!("✅ Successfully started Podman machine");

                                // Wait a bit for machine to fully initialize
                                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

                                // Emit event to frontend
                                if let Some(app_handle) = &self.app_handle {
                                    let _ = app_handle.emit(
                                        "podman-restarted",
                                        "Podman machine restarted successfully",
                                    );
                                }
                            } else {
                                let error_msg = String::from_utf8_lossy(&start_output.stderr);
                                error!("❌ Failed to start Podman machine: {}", error_msg);
                                return Err(BackendError::Container(format!(
                                    "Failed to start Podman machine: {}",
                                    error_msg
                                )));
                            }
                        }
                        Err(e) => {
                            error!("❌ Error starting Podman machine: {}", e);
                            return Err(BackendError::Container(format!(
                                "Error starting Podman machine: {}",
                                e
                            )));
                        }
                    }
                } else {
                    info!("✅ Podman machine is running");
                }
            }
            Err(e) => {
                error!("❌ Failed to check Podman machine status: {}", e);
                return Err(BackendError::Container(format!(
                    "Failed to check Podman machine status: {}",
                    e
                )));
            }
        }

        // Additional health check - try to run a simple podman command
        let health_result = tokio::process::Command::new("podman")
            .args(["info", "--format", "{{.Host.Arch}}"])
            .output()
            .await;

        match health_result {
            Ok(output) => {
                if output.status.success() {
                    info!("✅ Podman is responding to commands");
                } else {
                    warn!("⚠️ Podman machine running but not responding to commands");

                    // Try to restart podman machine
                    info!("🔄 Attempting to restart Podman machine...");
                    let _ = tokio::process::Command::new("podman")
                        .args(["machine", "stop"])
                        .output()
                        .await;

                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

                    let restart_result = tokio::process::Command::new("podman")
                        .args(["machine", "start"])
                        .output()
                        .await;

                    if let Ok(restart_output) = restart_result {
                        if restart_output.status.success() {
                            info!("✅ Podman machine restarted successfully");
                            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

                            if let Some(app_handle) = &self.app_handle {
                                let _ = app_handle.emit(
                                    "podman-restarted",
                                    "Podman machine restarted after health check failure",
                                );
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!("⚠️ Podman health check failed: {}", e);
            }
        }

        Ok(())
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
            setup_progress: self.setup_progress.clone(),
            app_handle: self.app_handle.clone(),
        }
    }
}

// Re-export the health monitor
pub use super::health::HealthMonitor;
