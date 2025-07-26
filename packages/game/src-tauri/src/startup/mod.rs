use crate::backend::{BackendError, BackendResult, ContainerRuntimeType};
use crate::container::{ContainerManager, RuntimeDetectionStatus};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupStatus {
    pub stage: StartupStage,
    pub progress: u8, // 0-100
    pub message: String,
    pub details: String,
    pub can_retry: bool,
    pub runtime_status: Option<RuntimeDetectionStatus>,
    pub container_statuses: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StartupStage {
    Initializing,
    DetectingRuntime,
    RuntimeDetected,
    PromptingConfig,
    ConfigReceived,
    InitializingContainers,
    StartingDatabase,
    StartingOllama,
    DownloadingModels,
    StartingAgent,
    WaitingForHealth,
    ContainersReady,
    StartingMessageServer,
    MessageServerReady,
    Ready,
    Error,
}

pub struct StartupManager {
    app_handle: AppHandle,
    status: Arc<Mutex<StartupStatus>>,
    container_manager: Option<Arc<ContainerManager>>,
    config: Option<UserConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub ai_provider: AiProvider,
    pub api_key: Option<String>,
    pub use_local_ollama: bool,
    pub postgres_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AiProvider {
    Ollama,
    OpenAI,
    Anthropic,
}

impl StartupManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let initial_status = StartupStatus {
            stage: StartupStage::Initializing,
            progress: 0,
            message: "Initializing ELIZA Game...".to_string(),
            details: "Starting up backend services".to_string(),
            can_retry: false,
            runtime_status: None,
            container_statuses: std::collections::HashMap::new(),
        };

        Self {
            app_handle,
            status: Arc::new(Mutex::new(initial_status)),
            container_manager: None,
            config: None,
        }
    }

    pub async fn start_initialization(
        &mut self,
        resource_dir: std::path::PathBuf,
    ) -> BackendResult<()> {
        info!("🚀 Starting ELIZA Game initialization sequence");

        // First check if ElizaOS server is already running
        if let Ok(true) = self.check_existing_server().await {
            info!("✅ Found existing ElizaOS server - skipping container setup");
            self.update_status(
                StartupStage::MessageServerReady,
                90,
                "ElizaOS server detected",
                "Using existing server instance",
            )
            .await;

            // Skip directly to ready
            self.update_status(
                StartupStage::Ready,
                100,
                "Ready to use ELIZA",
                "Connected to existing ElizaOS server",
            )
            .await;

            return Ok(());
        }

        // If no existing server, we must start containers - ensure Podman is ready
        self.update_status(
            StartupStage::DetectingRuntime,
            5,
            "Checking Podman machine status...",
            "Ensuring container runtime is ready",
        )
        .await;

        if let Err(e) = self.ensure_podman_ready().await {
            error!("Podman setup failed: {}", e);
            self.update_status(
                StartupStage::Error,
                0,
                "Podman setup failed",
                &format!(
                    "Please run 'podman machine start' and try again. Error: {}",
                    e
                ),
            )
            .await;
            return Err(e);
        }

        // Stage 1: Runtime Detection (only if no existing server)
        self.update_status(
            StartupStage::DetectingRuntime,
            10,
            "Detecting container runtime...",
            "Checking for Podman, Docker, or downloading runtime",
        )
        .await;

        match ContainerManager::new_with_runtime_manager(ContainerRuntimeType::Podman, resource_dir)
            .await
        {
            Ok(mut manager) => {
                // Set the app handle for event emission
                manager.set_app_handle(self.app_handle.clone());

                self.container_manager = Some(Arc::new(manager));
                self.update_status(
                    StartupStage::RuntimeDetected,
                    20,
                    "Container runtime detected successfully",
                    "Ready to configure containers",
                )
                .await;
            }
            Err(e) => {
                error!("Failed to detect container runtime: {}", e);
                self.update_status(
                    StartupStage::Error,
                    0,
                    "Container runtime detection failed",
                    &format!("Error: {}", e),
                )
                .await;
                return Err(e);
            }
        }

        // Stage 2: Use default configuration to avoid getting stuck
        self.update_status(
            StartupStage::PromptingConfig,
            25,
            "Using default configuration...",
            "Applying default AI provider and container settings",
        )
        .await;

        // Use default configuration instead of waiting for user input
        let default_config = UserConfig {
            ai_provider: AiProvider::Ollama,
            api_key: None,
            use_local_ollama: true,
            postgres_enabled: true,
        };

        // Automatically proceed with default configuration
        self.handle_user_config(default_config).await?;

        Ok(())
    }

    pub async fn handle_user_config(&mut self, config: UserConfig) -> BackendResult<()> {
        info!("📝 Received user configuration: {:?}", config);
        self.config = Some(config.clone());

        self.update_status(
            StartupStage::ConfigReceived,
            30,
            "Configuration received",
            "Starting container setup...",
        )
        .await;

        // Stage 3: Ensure agent image is available before setting up containers
        self.update_status(
            StartupStage::InitializingContainers,
            35,
            "Ensuring agent image is available...",
            "Building container image if needed",
        )
        .await;

        self.ensure_agentserver_image().await?;

        // Stage 4: Setup containers based on config
        self.setup_containers().await?;

        Ok(())
    }

    async fn check_existing_server(&self) -> Result<bool, reqwest::Error> {
        info!("🔍 Checking for existing ElizaOS server on port 7777...");

        let client = reqwest::Client::new();
        match client
            .get("http://localhost:7777/api/server/health")
            .timeout(std::time::Duration::from_secs(5)) // Increased timeout
            .send()
            .await
        {
            Ok(response) => {
                info!("📡 Server responded with status: {}", response.status());
                if response.status().is_success() {
                    let health_data: serde_json::Value = response.json().await?;
                    info!("🔍 Health data received: {}", health_data);
                    if health_data["status"].as_str() == Some("OK")
                        || health_data["success"].as_bool().unwrap_or(false)
                    {
                        info!("✅ ElizaOS server is healthy and ready");
                        return Ok(true);
                    } else {
                        info!("⚠️ Server responded but health check failed");
                    }
                } else {
                    info!("⚠️ Server responded with non-success status");
                }
                Ok(false)
            }
            Err(e) => {
                info!("❌ No ElizaOS server found on port 7777: {}", e);
                Ok(false)
            }
        }
    }

    async fn setup_containers(&mut self) -> BackendResult<()> {
        let container_manager = self.container_manager.as_ref().ok_or_else(|| {
            BackendError::Container("Container manager not initialized".to_string())
        })?;

        let config = self
            .config
            .as_ref()
            .ok_or_else(|| BackendError::Container("User config not available".to_string()))?;

        self.update_status(
            StartupStage::InitializingContainers,
            45,
            "Setting up containers...",
            "Preparing container environment",
        )
        .await;

        // Create container network for inter-container communication
        info!("Creating container network for inter-container communication");
        if let Err(e) = self.create_container_network(container_manager).await {
            warn!(
                "Failed to create container network: {}. Containers may have connectivity issues.",
                e
            );
        }

        // Start all containers in parallel for faster startup
        self.update_status(
            StartupStage::StartingDatabase,
            55,
            "Starting all containers in parallel...",
            "PostgreSQL, Ollama, and Agent starting simultaneously",
        )
        .await;

        info!("🚀 Starting containers in parallel...");

        let mut required_containers = Vec::new();
        let mut failed_containers = std::collections::HashMap::new();

        // Start PostgreSQL (required)
        let postgres_task = if config.postgres_enabled {
            required_containers.push("postgres");
            self.update_container_status("postgres", "building").await;
            Some(tokio::spawn({
                let container_manager = container_manager.clone();
                async move {
                    let result = container_manager.start_postgres().await;
                    ("postgres", result)
                }
            }))
        } else {
            None
        };

        // Start Ollama (optional unless it's the only AI provider)
        let ollama_required = matches!(config.ai_provider, AiProvider::Ollama);
        let ollama_task =
            if matches!(config.ai_provider, AiProvider::Ollama) || config.use_local_ollama {
                if ollama_required {
                    required_containers.push("ollama");
                }
                self.update_container_status("ollama", "building").await;
                Some(tokio::spawn({
                    let container_manager = container_manager.clone();
                    async move {
                        let result = container_manager.start_ollama().await;
                        ("ollama", result)
                    }
                }))
            } else {
                None
            };

        // Note: Agent will be started after Ollama is ready with models
        required_containers.push("agent");

        // Wait for all initial tasks and process results as they complete
        let mut completed_count = 0;
        let total_count = if postgres_task.is_some() { 1 } else { 0 }
            + if ollama_task.is_some() { 1 } else { 0 }
            + 1; // +1 for agent

        // Process PostgreSQL result
        if let Some(task) = postgres_task {
            self.update_container_status("postgres", "starting").await;
            match task.await {
                Ok(("postgres", Ok(_status))) => {
                    info!("✅ PostgreSQL container started, verifying health...");

                    // Verify container is actually running and healthy
                    match self
                        .verify_container_health(container_manager, "postgres", "eliza-postgres")
                        .await
                    {
                        Ok(true) => {
                            info!("✅ PostgreSQL container is healthy and ready");
                            completed_count += 1;
                            self.update_container_status("postgres", "running").await;
                            let progress = 55 + (completed_count * 8) as u8;
                            self.update_status(
                                StartupStage::StartingDatabase,
                                progress,
                                "PostgreSQL container ready",
                                &format!("{}/{} containers started", completed_count, total_count),
                            )
                            .await;
                        }
                        Ok(false) => {
                            let error = BackendError::Container(
                                "PostgreSQL container started but failed health check".to_string(),
                            );
                            failed_containers.insert("postgres", error);
                            error!("❌ PostgreSQL container started but is not healthy");
                            self.update_container_status("postgres", "unhealthy").await;
                        }
                        Err(e) => {
                            failed_containers.insert("postgres", e);
                            error!("❌ Failed to verify PostgreSQL container health");
                            self.update_container_status("postgres", "error").await;
                        }
                    }
                }
                Ok(("postgres", Err(e))) => {
                    failed_containers.insert("postgres", e);
                    error!(
                        "❌ Failed to start PostgreSQL container: {}",
                        failed_containers["postgres"]
                    );
                    self.update_container_status("postgres", "failed").await;
                }
                Err(e) => {
                    failed_containers.insert(
                        "postgres",
                        BackendError::Container(format!("Task error: {}", e)),
                    );
                    error!("❌ PostgreSQL task failed: {}", e);
                    self.update_container_status("postgres", "failed").await;
                }
                Ok((_, _)) => {
                    let error = BackendError::Container("Unexpected task result".to_string());
                    failed_containers.insert("postgres", error);
                    error!("❌ PostgreSQL task returned unexpected result");
                    self.update_container_status("postgres", "failed").await;
                }
            }
        }

        // Process Ollama result
        if let Some(task) = ollama_task {
            self.update_container_status("ollama", "starting").await;
            match task.await {
                Ok(("ollama", Ok(_status))) => {
                    info!("✅ Ollama container started, verifying health...");

                    // Verify container is actually running and healthy
                    match self
                        .verify_container_health(container_manager, "ollama", "eliza-ollama")
                        .await
                    {
                        Ok(true) => {
                            info!("✅ Ollama container is healthy and ready");

                            // Pull required models before marking as complete
                            self.update_status(
                                StartupStage::StartingOllama,
                                60,
                                "Pulling required Ollama models...",
                                "This may take a few minutes on first run",
                            )
                            .await;

                            match container_manager.pull_ollama_models().await {
                                Ok(()) => {
                                    info!("✅ Ollama models pulled successfully");
                                    completed_count += 1;
                                    self.update_container_status("ollama", "running").await;
                                    let progress = 55 + (completed_count * 8) as u8;
                                    self.update_status(
                                        StartupStage::StartingOllama,
                                        progress,
                                        "Ollama container ready with models",
                                        &format!(
                                            "{}/{} containers started",
                                            completed_count, total_count
                                        ),
                                    )
                                    .await;
                                }
                                Err(e) => {
                                    let error = BackendError::Container(format!(
                                        "Failed to pull Ollama models: {}",
                                        e
                                    ));
                                    failed_containers.insert("ollama", error);
                                    error!("❌ Failed to pull required Ollama models: {}", e);
                                    self.update_container_status("ollama", "error").await;
                                }
                            }
                        }
                        Ok(false) => {
                            let error = BackendError::Container(
                                "Ollama container started but failed health check".to_string(),
                            );
                            failed_containers.insert("ollama", error);
                            if ollama_required {
                                error!("❌ Required Ollama container started but is not healthy");
                            } else {
                                warn!("⚠️ Optional Ollama container started but is not healthy");
                            }
                            self.update_container_status("ollama", "unhealthy").await;
                        }
                        Err(e) => {
                            failed_containers.insert("ollama", e);
                            if ollama_required {
                                error!("❌ Failed to verify required Ollama container health");
                            } else {
                                warn!("⚠️ Failed to verify optional Ollama container health");
                            }
                            self.update_container_status("ollama", "error").await;
                        }
                    }
                }
                Ok(("ollama", Err(e))) => {
                    failed_containers.insert("ollama", e);
                    if ollama_required {
                        error!(
                            "❌ Failed to start required Ollama container: {}",
                            failed_containers["ollama"]
                        );
                    } else {
                        warn!(
                            "⚠️ Failed to start optional Ollama container: {}",
                            failed_containers["ollama"]
                        );
                    }
                    self.update_container_status("ollama", "failed").await;
                }
                Err(e) => {
                    failed_containers.insert(
                        "ollama",
                        BackendError::Container(format!("Task error: {}", e)),
                    );
                    error!("❌ Ollama task failed: {}", e);
                    self.update_container_status("ollama", "failed").await;
                }
                Ok((_, _)) => {
                    let error = BackendError::Container("Unexpected task result".to_string());
                    failed_containers.insert("ollama", error);
                    error!("❌ Ollama task returned unexpected result");
                    self.update_container_status("ollama", "failed").await;
                }
            }
        }

        // Now start the agent after Ollama is ready
        let ollama_ready = !failed_containers.contains_key("ollama")
            && (matches!(config.ai_provider, AiProvider::Ollama) || config.use_local_ollama);

        // Only start agent if dependencies are satisfied
        if !ollama_ready
            && (matches!(config.ai_provider, AiProvider::Ollama) || config.use_local_ollama)
        {
            let error =
                BackendError::Container("Cannot start agent: Ollama is not ready".to_string());
            failed_containers.insert("agent", error);
            error!("❌ Cannot start agent because Ollama failed to start or pull models");
            self.update_container_status("agent", "failed").await;
        } else {
            // Start the agent container now
            self.update_container_status("agent", "building").await;
            let agent_result = container_manager.start_agent().await;

            self.update_container_status("agent", "starting").await;
            match agent_result {
                Ok(_status) => {
                    info!("✅ Agent container started, verifying health...");

                    // Verify container is actually running and healthy
                    match self
                        .verify_container_health(container_manager, "agent", "eliza-agent")
                        .await
                    {
                        Ok(true) => {
                            info!("✅ Agent container is healthy and ready");
                            completed_count += 1;
                            self.update_container_status("agent", "running").await;
                            let progress = 55 + (completed_count * 8) as u8;
                            self.update_status(
                                StartupStage::StartingAgent,
                                progress,
                                "Agent container ready",
                                &format!("{}/{} containers started", completed_count, total_count),
                            )
                            .await;
                        }
                        Ok(false) => {
                            let error = BackendError::Container(
                                "Agent container started but failed health check".to_string(),
                            );
                            failed_containers.insert("agent", error);
                            error!("❌ Agent container started but is not healthy");
                            self.update_container_status("agent", "unhealthy").await;
                        }
                        Err(e) => {
                            failed_containers.insert("agent", e);
                            error!("❌ Failed to verify Agent container health");
                            self.update_container_status("agent", "error").await;
                        }
                    }
                }
                Err(e) => {
                    failed_containers.insert("agent", e);
                    error!(
                        "❌ Failed to start Agent container: {}",
                        failed_containers["agent"]
                    );
                    self.update_container_status("agent", "failed").await;
                }
            }
        }

        // Check if any required containers failed
        for required_container in &required_containers {
            if let Some(error) = failed_containers.get(required_container) {
                self.update_status(
                    StartupStage::Error,
                    0,
                    &format!("Failed to start required {} container", required_container),
                    &format!(
                        "Error: {}. This container is required for game functionality.",
                        error
                    ),
                )
                .await;
                return Err(BackendError::Container(format!(
                    "Failed to start required {} container: {}",
                    required_container, error
                )));
            }
        }

        info!(
            "🎉 All required containers started successfully! ({}/{} total)",
            completed_count, total_count
        );

        // Stage 4: Wait for container health checks
        self.update_status(
            StartupStage::WaitingForHealth,
            85,
            "Waiting for containers to be healthy...",
            "Performing health checks",
        )
        .await;

        self.wait_for_container_health().await?;

        // Stage 5: All containers ready
        self.update_status(
            StartupStage::ContainersReady,
            95,
            "All containers are healthy",
            "Finalizing initialization",
        )
        .await;

        // Stage 6: Everything ready!
        self.update_status(
            StartupStage::Ready,
            100,
            "ELIZA Game ready!",
            "All systems initialized - ready for chat",
        )
        .await;

        info!("🎉 ELIZA Game initialization completed successfully!");

        Ok(())
    }

    async fn wait_for_container_health(&self) -> BackendResult<()> {
        let container_manager = self.container_manager.as_ref().ok_or_else(|| {
            BackendError::Container("Container manager not initialized".to_string())
        })?;

        // Wait for containers to be healthy (simplified)
        let max_wait = 30; // 30 seconds max
        for i in 0..max_wait {
            let statuses = container_manager.get_all_statuses().await?;
            let all_healthy = statuses
                .iter()
                .all(|status| matches!(status.health, crate::backend::HealthStatus::Healthy));

            if all_healthy {
                info!("✅ All containers are healthy");
                return Ok(());
            }

            if i % 5 == 0 {
                info!(
                    "⏳ Waiting for containers to be healthy... ({}/{})",
                    i, max_wait
                );
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }

        Err(BackendError::Container(
            "Containers failed to become healthy within timeout".to_string(),
        ))
    }

    async fn update_status(&self, stage: StartupStage, progress: u8, message: &str, details: &str) {
        let mut status = self.status.lock().unwrap();
        status.stage = stage;
        status.progress = progress;
        status.message = message.to_string();
        status.details = details.to_string();

        let status_clone = status.clone();
        drop(status);

        // Emit to frontend
        if let Err(e) = self.app_handle.emit("startup-status", &status_clone) {
            error!("Failed to emit startup status: {}", e);
        }
    }

    async fn update_container_status(&self, container_name: &str, status: &str) {
        let mut startup_status = self.status.lock().unwrap();
        startup_status
            .container_statuses
            .insert(container_name.to_string(), status.to_string());

        let status_clone = startup_status.clone();
        drop(startup_status);

        // Emit to frontend
        if let Err(e) = self.app_handle.emit("startup-status", &status_clone) {
            error!("Failed to emit container status update: {}", e);
        }
    }

    pub fn get_current_status(&self) -> StartupStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn is_ready(&self) -> bool {
        matches!(self.status.lock().unwrap().stage, StartupStage::Ready)
    }

    pub fn get_container_manager(&self) -> Option<Arc<ContainerManager>> {
        self.container_manager.clone()
    }

    async fn create_container_network(
        &self,
        container_manager: &Arc<ContainerManager>,
    ) -> BackendResult<()> {
        container_manager.create_network("eliza-network").await
    }

    async fn ensure_podman_ready(&self) -> BackendResult<()> {
        info!("🔍 Checking Podman machine status...");

        // Check if Podman machine is running
        let output = tokio::process::Command::new("podman")
            .args(["machine", "list"])
            .output()
            .await
            .map_err(|e| {
                BackendError::Container(format!("Failed to check Podman machine: {}", e))
            })?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        if !output_str.contains("Currently running") {
            warn!("⚠️ Podman machine not running, attempting to start...");

            let start_output = tokio::process::Command::new("podman")
                .args(["machine", "start"])
                .output()
                .await
                .map_err(|e| {
                    BackendError::Container(format!("Failed to start Podman machine: {}", e))
                })?;

            if !start_output.status.success() {
                let error_str = String::from_utf8_lossy(&start_output.stderr);
                return Err(BackendError::Container(format!(
                    "Podman machine start failed: {}",
                    error_str
                )));
            }

            info!("✅ Podman machine started successfully");
        } else {
            info!("✅ Podman machine already running");
        }

        // Test connection
        let test_output = tokio::process::Command::new("podman")
            .args(["version"])
            .output()
            .await
            .map_err(|e| {
                BackendError::Container(format!("Failed to test Podman connection: {}", e))
            })?;

        if !test_output.status.success() {
            let error_str = String::from_utf8_lossy(&test_output.stderr);
            return Err(BackendError::Container(format!(
                "Podman connection test failed: {}",
                error_str
            )));
        }

        info!("✅ Podman connection verified");
        Ok(())
    }

    async fn ensure_agentserver_image(&self) -> BackendResult<()> {
        info!("🔍 Checking for eliza-agent-server:latest image...");

        let output = tokio::process::Command::new("podman")
            .args(["image", "exists", "eliza-agent-server:latest"])
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to check image: {}", e)))?;

        if output.status.success() {
            info!("✅ eliza-agent-server:latest image found");
            return Ok(());
        }

        warn!("⚠️ eliza-agent-server:latest image not found, building...");

        // Change to agentserver directory and build
        let current_dir = std::env::current_dir().map_err(|e| {
            BackendError::Container(format!("Failed to get current directory: {}", e))
        })?;

        let agentserver_dir = current_dir.join("packages").join("agentserver");

        if !agentserver_dir.exists() {
            return Err(BackendError::Container(
                "packages/agentserver directory not found. Please ensure you're running from the project root.".to_string()
            ));
        }

        info!("📦 Building Linux binary for containerization...");
        let binary_output = tokio::process::Command::new("bun")
            .args(["run", "build:binary", "linux"])
            .current_dir(&agentserver_dir)
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to build binary: {}", e)))?;

        if !binary_output.status.success() {
            let error_str = String::from_utf8_lossy(&binary_output.stderr);
            return Err(BackendError::Container(format!(
                "Binary build failed: {}",
                error_str
            )));
        }

        info!("🐳 Building Docker image...");
        let docker_output = tokio::process::Command::new("podman")
            .args([
                "build",
                "-f",
                "Dockerfile.standalone",
                "-t",
                "eliza-agent-server:latest",
                ".",
            ])
            .current_dir(&agentserver_dir)
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to build image: {}", e)))?;

        if !docker_output.status.success() {
            let error_str = String::from_utf8_lossy(&docker_output.stderr);
            return Err(BackendError::Container(format!(
                "Image build failed: {}",
                error_str
            )));
        }

        info!("✅ eliza-agent-server:latest image built successfully");
        Ok(())
    }

    async fn verify_container_health(
        &self,
        container_manager: &Arc<ContainerManager>,
        service_name: &str,
        container_name: &str,
    ) -> BackendResult<bool> {
        info!("🔍 Verifying {} container health...", service_name);

        // Wait a moment for container to initialize
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Check container status first
        match container_manager
            .get_runtime_container_status(container_name)
            .await
        {
            Ok(status) => {
                match status.state {
                    crate::backend::ContainerState::Running => {
                        info!("✅ {} container is running", service_name);

                        // Additional health checks based on service type
                        match service_name {
                            "postgres" => {
                                // Test PostgreSQL connection
                                self.test_postgres_connection().await
                            }
                            "agent" => {
                                // Test Agent API health endpoint
                                self.test_agent_health().await
                            }
                            "ollama" => {
                                // Test Ollama API endpoint
                                self.test_ollama_health().await
                            }
                            _ => Ok(true), // Unknown service, assume healthy if running
                        }
                    }
                    crate::backend::ContainerState::Starting => {
                        warn!("⚠️ {} container is still starting", service_name);

                        // Wait a bit longer for starting containers
                        let mut attempts = 0;
                        while attempts < 10 {
                            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                            attempts += 1;

                            match container_manager
                                .get_runtime_container_status(container_name)
                                .await
                            {
                                Ok(status)
                                    if status.state == crate::backend::ContainerState::Running =>
                                {
                                    info!("✅ {} container finished starting", service_name);
                                    return Box::pin(self.verify_container_health(
                                        container_manager,
                                        service_name,
                                        container_name,
                                    ))
                                    .await;
                                }
                                Ok(status)
                                    if status.state == crate::backend::ContainerState::Stopped =>
                                {
                                    error!("❌ {} container stopped unexpectedly", service_name);
                                    return Ok(false);
                                }
                                _ => {
                                    info!(
                                        "⏳ {} container still starting... (attempt {}/10)",
                                        service_name, attempts
                                    );
                                }
                            }
                        }

                        error!(
                            "❌ {} container failed to start within timeout",
                            service_name
                        );
                        Ok(false)
                    }
                    _ => {
                        error!(
                            "❌ {} container is in unexpected state: {:?}",
                            service_name, status.state
                        );
                        Ok(false)
                    }
                }
            }
            Err(e) => {
                error!("❌ Failed to get {} container status: {}", service_name, e);
                Ok(false)
            }
        }
    }

    async fn test_postgres_connection(&self) -> BackendResult<bool> {
        info!("🔍 Testing PostgreSQL connection...");

        // Try to connect to PostgreSQL using pg_isready equivalent
        let test_output = tokio::process::Command::new("podman")
            .args([
                "exec",
                "eliza-postgres",
                "pg_isready",
                "-U",
                "eliza",
                "-d",
                "eliza_game",
            ])
            .output()
            .await
            .map_err(|e| {
                BackendError::Container(format!("Failed to test PostgreSQL connection: {}", e))
            })?;

        if test_output.status.success() {
            info!("✅ PostgreSQL connection test successful");
            Ok(true)
        } else {
            let error_str = String::from_utf8_lossy(&test_output.stderr);
            warn!("⚠️ PostgreSQL connection test failed: {}", error_str);
            Ok(false)
        }
    }

    async fn test_agent_health(&self) -> BackendResult<bool> {
        info!("🔍 Testing Agent API health...");

        let client = reqwest::Client::new();
        match client
            .get("http://localhost:7777/api/server/health")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    let health_data: serde_json::Value = response.json().await.map_err(|e| {
                        BackendError::Container(format!("Failed to parse health response: {}", e))
                    })?;

                    if health_data["success"].as_bool().unwrap_or(false)
                        || health_data["data"]["status"].as_str() == Some("healthy")
                        || health_data["status"].as_str() == Some("OK")
                    {
                        info!("✅ Agent API health check successful");
                        Ok(true)
                    } else {
                        warn!("⚠️ Agent API responded but health check failed");
                        Ok(false)
                    }
                } else {
                    warn!(
                        "⚠️ Agent API health check returned status: {}",
                        response.status()
                    );
                    Ok(false)
                }
            }
            Err(e) => {
                warn!("⚠️ Agent API health check failed: {}", e);
                Ok(false)
            }
        }
    }

    async fn test_ollama_health(&self) -> BackendResult<bool> {
        info!("🔍 Testing Ollama API health...");

        let client = reqwest::Client::new();
        match client
            .get("http://localhost:11434/api/tags")
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    info!("✅ Ollama API health check successful");
                    Ok(true)
                } else {
                    warn!(
                        "⚠️ Ollama API health check returned status: {}",
                        response.status()
                    );
                    Ok(false)
                }
            }
            Err(e) => {
                warn!("⚠️ Ollama API health check failed: {}", e);
                Ok(false)
            }
        }
    }
}
