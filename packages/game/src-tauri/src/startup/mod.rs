use crate::backend::{BackendError, BackendResult, ContainerRuntimeType};
use crate::container::{ContainerManager, RuntimeDetectionStatus};
use crate::common::{AGENT_CONTAINER, OLLAMA_CONTAINER};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tracing::{error, info, warn};

mod memory;
pub use memory::{MemoryConfig, ContainerMemoryLimits};

#[derive(Debug, Clone)]
#[allow(clippy::enum_variant_names)]
enum OllamaStatus {
    ContainerizedRunning,  // Our containerized Ollama on port 17777
    NativeRunning,         // Native Ollama installation on port 11434
    NotRunning,           // No Ollama found
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupStatus {
    pub stage: StartupStage,
    pub progress: u8, // 0-100
    pub message: String,
    pub details: String,
    pub can_retry: bool,
    pub runtime_status: Option<RuntimeDetectionStatus>,
    pub container_statuses: std::collections::HashMap<String, String>,
    pub game_api_ready: bool,
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
    VerifyingGameAPI,
    GameAPIReady,
    RunningTests,
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
            game_api_ready: false,
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
        let mut server_healthy = false;
        let mut recovery_attempted = false;
        
        // Try up to 2 times: first check, then recovery + check
        for attempt in 0..2 {
            match self.check_existing_server().await {
                Ok(true) => {
                    server_healthy = true;
                    break;
                }
                Ok(false) | Err(_) => {
                    if attempt == 0 && !recovery_attempted {
                        // First attempt failed, try recovery
                        warn!("⚠️ ElizaOS server not responding, attempting recovery...");
                        
                        // Ensure we have Podman ready first
                        self.update_status(
                            StartupStage::DetectingRuntime,
                            5,
                            "Ensuring container runtime is ready for recovery...",
                            "Checking Podman status",
                        )
                        .await;
                        
                        if let Err(e) = self.ensure_podman_ready().await {
                            error!("Podman setup failed during recovery: {}", e);
                            // Continue to normal startup flow
                            break;
                        }
                        
                        // Initialize container manager for recovery if not already done
                        if self.container_manager.is_none() {
                            match ContainerManager::new_with_runtime_manager(ContainerRuntimeType::Podman, resource_dir.clone())
                                .await
                            {
                                Ok(mut manager) => {
                                    manager.set_app_handle(self.app_handle.clone());
                                    
                                    // Calculate and set memory limits based on system resources
                                    let memory_config = MemoryConfig::calculate();
                                    if memory_config.has_sufficient_memory {
                                        let container_limits = memory_config.get_container_limits();
                                        manager.set_memory_limits(container_limits);
                                    }
                                    
                                    self.container_manager = Some(Arc::new(manager));
                                }
                                Err(e) => {
                                    error!("Failed to create container manager for recovery: {}", e);
                                    // Continue to normal startup
                                    break;
                                }
                            }
                        }
                        
                        // Attempt recovery
                        if let Err(e) = self.recover_elizaos_server().await {
                            error!("Recovery failed: {}", e);
                            // Continue to normal startup
                            break;
                        }
                        
                        recovery_attempted = true;
                        // Wait a bit for the server to stabilize after recovery
                        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                        
                        // Loop will retry the health check
                    } else {
                        // Recovery already attempted or second check failed
                        break;
                    }
                }
            }
        }
        
        if server_healthy {
            info!("✅ Found healthy ElizaOS server - checking Ollama status");
            
            // Even with existing server, we need to ensure Ollama is running
            self.update_status(
                StartupStage::DetectingRuntime,
                10,
                "Checking container runtime...",
                "Ensuring Podman and Ollama are ready",
            )
            .await;

            // Ensure Podman is ready
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

            // Initialize container manager if needed
            if self.container_manager.is_none() {
                match ContainerManager::new_with_runtime_manager(ContainerRuntimeType::Podman, resource_dir.clone())
                    .await
                {
                    Ok(mut manager) => {
                        manager.set_app_handle(self.app_handle.clone());
                        
                        // Calculate and set memory limits based on system resources
                        let memory_config = MemoryConfig::calculate();
                        if memory_config.has_sufficient_memory {
                            let container_limits = memory_config.get_container_limits();
                            manager.set_memory_limits(container_limits);
                        }
                        
                        self.container_manager = Some(Arc::new(manager));
                    }
                    Err(e) => {
                        error!("Failed to create container manager: {}", e);
                        self.update_status(
                            StartupStage::Error,
                            0,
                            "Container runtime initialization failed",
                            &format!("Error: {}", e),
                        )
                        .await;
                        return Err(e);
                    }
                }
            }

            // Check and start Ollama if needed
            self.update_status(
                StartupStage::StartingOllama,
                40,
                "Checking Ollama status...",
                "Ensuring AI model server is running",
            )
            .await;

            // Check current Ollama status
            let ollama_status = self.check_ollama_status().await?;
            
            match ollama_status {
                OllamaStatus::ContainerizedRunning => {
                    info!("✅ Our containerized Ollama is already running on eliza-network");
                }
                OllamaStatus::NativeRunning | OllamaStatus::NotRunning => {
                    let status_msg = match ollama_status {
                        OllamaStatus::NativeRunning => "Found Ollama on port 11434, but need our container for network isolation",
                        _ => "No Ollama detected",
                    };
                    
                    info!("🔍 {}", status_msg);
                    info!("🚀 Starting our containerized Ollama on eliza-network");
                    
                    if let Some(manager) = &self.container_manager {
                        // Create network if it doesn't exist
                        if let Err(e) = manager.ensure_network_exists(crate::common::NETWORK_NAME).await {
                            warn!("Failed to ensure network exists: {}", e);
                        }
                        
                        // Start our Ollama on eliza-network
                        match manager.start_ollama().await {
                            Ok(_) => {
                                info!("✅ Containerized Ollama started successfully on eliza-network");
                                
                                // Wait for health check
                                if let Err(e) = manager.wait_for_container_health(OLLAMA_CONTAINER, std::time::Duration::from_secs(60)).await {
                                    error!("Ollama health check failed: {}", e);
                                    self.update_status(
                                        StartupStage::Error,
                                        0,
                                        "Ollama startup failed",
                                        &format!("Failed to start AI model server: {}", e),
                                    )
                                    .await;
                                    return Err(e);
                                }
                                
                                // Pull models
                                self.update_status(
                                    StartupStage::DownloadingModels,
                                    60,
                                    "Downloading AI models...",
                                    "Pulling required models for agent operation",
                                )
                                .await;
                                
                                if let Err(e) = manager.pull_ollama_models().await {
                                    error!("Failed to pull Ollama models: {}", e);
                                    warn!("⚠️ Some models may not be available: {}", e);
                                }
                            }
                            Err(e) => {
                                error!("Failed to start Ollama: {}", e);
                                self.update_status(
                                    StartupStage::Error,
                                    0,
                                    "Ollama startup failed",
                                    &format!("Failed to start AI model server: {}", e),
                                )
                                .await;
                                return Err(e);
                            }
                        }
                    }
                }
            }

            // Now we're ready with existing server + Ollama
            self.update_status(
                StartupStage::VerifyingGameAPI,
                90,
                "Verifying Game API...",
                "Checking Game API plugin connectivity",
            )
            .await;

            // Verify Game API is ready
            match self.verify_game_api().await {
                Ok(true) => {
                    self.update_status(
                        StartupStage::Ready,
                        100,
                        "Ready to use ELIZA",
                        "Connected to existing ElizaOS server with Game API",
                    )
                    .await;
                }
                Ok(false) => {
                    self.update_status(
                        StartupStage::Error,
                        0,
                        "Game API not available",
                        "ElizaOS server is running but Game API plugin is not responding. Chat will be disabled.",
                    )
                    .await;
                    
                    return Err(BackendError::Container("Game API plugin not available".to_string()));
                }
                Err(e) => {
                    self.update_status(
                        StartupStage::Error,
                        0,
                        "Game API verification error",
                        &format!("Failed to verify Game API: {}", e),
                    )
                    .await;
                    
                    return Err(e);
                }
            }

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
                
                // Calculate and set memory limits based on system resources
                let memory_config = MemoryConfig::calculate();
                if memory_config.has_sufficient_memory {
                    let container_limits = memory_config.get_container_limits();
                    manager.set_memory_limits(container_limits);
                }

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

    /// Performs aggressive recovery when ElizaOS server is not responding
    /// This kills any process on port 7777 and cleans up eliza-agent containers
    async fn recover_elizaos_server(&self) -> BackendResult<()> {
        warn!("🚨 Starting ElizaOS server recovery process...");

        // Step 1: Kill any process using port 7777
        info!("🔪 Killing any processes on port 7777...");
                    if let Err(e) = crate::common::kill_processes_on_port(7777).await {
            warn!("Failed to kill processes on port 7777: {}", e);
            // Continue anyway, the port might already be free
        }

        // Step 2: Clean up any eliza-agent containers
        if let Some(manager) = &self.container_manager {
            info!("🧹 Cleaning up eliza-agent containers...");
            if let Err(e) = manager.cleanup_containers_by_pattern(AGENT_CONTAINER).await {
                error!("Failed to clean up eliza-agent containers: {}", e);
                // Still continue, we'll try to start fresh
            }

            // Step 3: Wait a bit for cleanup to complete
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            // Step 4: Restart the agent container
            info!("🔄 Restarting eliza-agent container...");
            
            // Update status
            self.update_status(
                StartupStage::StartingAgent,
                70,
                "Restarting agent after recovery...",
                "Setting up fresh ElizaOS agent container",
            )
            .await;

            match manager.start_agent().await {
                Ok(_) => {
                    info!("✅ Agent container restarted successfully");
                    
                    // Wait for it to become healthy
                    if let Err(e) = manager.wait_for_container_health(AGENT_CONTAINER, std::time::Duration::from_secs(60)).await {
                        error!("Agent health check failed after restart: {}", e);
                        
                        // Get container logs to help debug the issue
                        error!("📋 Fetching eliza-agent container logs for debugging...");
                        match manager.get_container_logs(AGENT_CONTAINER, Some(200)).await {
                            Ok(logs) => {
                                error!("=== Recent eliza-agent container logs ===");
                                for line in logs.lines().take(50) {
                                    error!("  {}", line);
                                }
                                error!("=== End of container logs ===");
                            }
                            Err(log_err) => {
                                error!("Failed to fetch container logs: {}", log_err);
                            }
                        }
                        
                        return Err(e);
                    }
                }
                Err(e) => {
                    error!("Failed to restart agent container: {}", e);
                    
                    // Try to get logs even if container failed to start
                    error!("📋 Attempting to fetch any available eliza-agent container logs...");
                    match manager.get_container_logs(AGENT_CONTAINER, Some(200)).await {
                        Ok(logs) => {
                            error!("=== Recent eliza-agent container logs ===");
                            for line in logs.lines().take(50) {
                                error!("  {}", line);
                            }
                            error!("=== End of container logs ===");
                        }
                        Err(log_err) => {
                            error!("No container logs available: {}", log_err);
                        }
                    }
                    
                    return Err(e);
                }
            }
        } else {
            return Err(BackendError::Container("Container manager not available for recovery".to_string()));
        }

        info!("✅ ElizaOS server recovery completed");
        Ok(())
    }

    async fn check_ollama_status(&self) -> BackendResult<OllamaStatus> {
        info!("🔍 Checking Ollama availability...");
        
        // Check if our containerized Ollama is running
        if let Some(manager) = &self.container_manager {
            match manager.get_container_status(OLLAMA_CONTAINER).await {
                Ok(status) if matches!(status.health, crate::backend::HealthStatus::Healthy) => {
                    info!("✅ Found containerized Ollama (eliza-ollama) running and healthy");
                    return Ok(OllamaStatus::ContainerizedRunning);
                }
                Ok(status) => {
                    info!("📍 Found eliza-ollama container but it's not healthy: {:?}", status.health);
                }
                Err(e) => {
                    info!("📍 No eliza-ollama container found: {}", e);
                }
            }
        }
        
        // Check if native Ollama is running on default port
        let client = reqwest::Client::new();
        match client
            .get("http://localhost:11434/api/version")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                info!("🔍 Found Ollama on port 11434 (could be native or another container)");
                // We still need our own container for network isolation
                return Ok(OllamaStatus::NativeRunning);
            }
            _ => {
                info!("❌ No Ollama service found");
            }
        }
        
        Ok(OllamaStatus::NotRunning)
    }

    async fn verify_game_api(&self) -> BackendResult<bool> {
        info!("🎮 Verifying Game API plugin connectivity...");
        
        let client = reqwest::Client::new();
        let max_attempts = 20;
        
        for attempt in 0..max_attempts {
            self.update_status(
                StartupStage::VerifyingGameAPI,
                95 + (attempt * 5 / max_attempts) as u8, // Progress from 95 to 100
                "Verifying Game API plugin...",
                &format!("Checking Game API availability (attempt {}/{})", attempt + 1, max_attempts),
            )
            .await;
            
            // First check basic health
            let health_url = "http://localhost:7777/api/server/health";
            let health_response = client
                .get(health_url)
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await;
                
            if let Ok(response) = health_response {
                if response.status().is_success() {
                    // Use the actual agent ID
                    let agent_id = "2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f";
                    let settings_url = format!("http://localhost:7777/api/agents/{}/settings", agent_id);
                    let settings_response = client
                        .get(&settings_url)
                        .timeout(std::time::Duration::from_secs(5))
                        .send()
                        .await;
                    
                    if let Ok(settings_resp) = settings_response {
                        let status = settings_resp.status();
                        
                        // Accept success (200) or service unavailable (503) which means route exists but runtime not ready
                        if status.is_success() || status.as_u16() == 503 {
                            if status.is_success() {
                                info!("✅ Game API plugin routes are ready and responding");
                            } else {
                                info!("✅ Game API plugin routes exist (runtime initializing)");
                            }
                            
                            self.update_status(
                                StartupStage::GameAPIReady,
                                100,
                                "Game API verified!",
                                "All systems operational - ready to play",
                            )
                            .await;
                            
                            return Ok(true);
                        } else if status.as_u16() == 404 {
                            // Try to get the primary agent and use its endpoint
                            info!("⚠️ Default endpoint not found, trying primary agent discovery...");
                            
                            let primary_url = "http://localhost:7777/api/agents/primary";
                            if let Ok(primary_resp) = client.get(primary_url).timeout(std::time::Duration::from_secs(2)).send().await {
                                if primary_resp.status().is_success() {
                                    if let Ok(primary_data) = primary_resp.json::<serde_json::Value>().await {
                                        if let Some(true) = primary_data["data"]["available"].as_bool() {
                                            info!("✅ Primary agent discovered, Game API is ready");
                                            
                                            self.update_status(
                                                StartupStage::GameAPIReady,
                                                100,
                                                "Game API verified!",
                                                "All systems operational - ready to play",
                                            )
                                            .await;
                                            
                                            return Ok(true);
                                        }
                                    }
                                }
                            }
                            
                            warn!("⚠️ Game API plugin routes not found (404) and primary agent not available");
                        } else {
                            warn!("⚠️ Game API plugin routes not ready yet (status: {})", status);
                            
                            // Try to get error details
                            if let Ok(error_text) = settings_resp.text().await {
                                warn!("⚠️ Error response: {}", error_text);
                            }
                        }
                    } else if let Err(e) = settings_response {
                        warn!("⚠️ Failed to connect to settings endpoint: {}", e);
                    }
                }
            }
            
            if attempt < max_attempts - 1 {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
        }
        
        warn!("❌ Game API verification failed after {} attempts", max_attempts);
        Ok(false)
    }

    async fn setup_containers(&mut self) -> BackendResult<()> {
        let container_manager = self.container_manager.as_ref().ok_or_else(|| {
            BackendError::Container("Container manager not initialized".to_string())
        })?;

        let _config = self
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

        // Use the new robust container startup method with retry logic
        info!("🚀 Starting containers with dependency management and retry logic...");
        
        // Start containers with proper error handling and retries
        match container_manager.start_containers_with_dependencies().await {
            Ok(()) => {
                info!("✅ All containers started successfully");
                
                // Update status to indicate containers are ready
                self.update_status(
                    StartupStage::ContainersReady,
                    90,
                    "All containers are healthy",
                    "PostgreSQL, Ollama, and Agent are running",
                )
                .await;

                // Start message server after all containers are ready
                self.update_status(
                    StartupStage::StartingMessageServer,
                    95,
                    "Initializing message server...",
                    "Starting WebSocket connection to agent",
                )
                .await;

                // Give a moment for all services to stabilize
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                // Verify Game API plugin is ready before declaring success
                match self.verify_game_api().await {
                    Ok(true) => {
                        self.update_status(
                            StartupStage::Ready,
                            100,
                            "ELIZA Game is ready!",
                            "All systems operational",
                        )
                        .await;

                        Ok(())
                    }
                    Ok(false) => {
                        error!("❌ Game API verification failed");
                        
                        self.update_status(
                            StartupStage::Error,
                            0,
                            "Game API verification failed",
                            "The Game API plugin is not responding. Chat functionality will be disabled.",
                        )
                        .await;

                        Err(BackendError::Container("Game API plugin verification failed".to_string()))
                    }
                    Err(e) => {
                        error!("❌ Error during Game API verification: {}", e);
                        
                        self.update_status(
                            StartupStage::Error,
                            0,
                            "Game API verification error",
                            &format!("Failed to verify Game API: {}", e),
                        )
                        .await;

                        Err(e)
                    }
                }
            }
            Err(e) => {
                error!("❌ Failed to start containers: {}", e);
                
                self.update_status(
                    StartupStage::Error,
                    0,
                    "Container startup failed",
                    &format!("Error: {}\n\nPlease check Podman status and try again.", e),
                )
                .await;

                Err(e)
            }
        }
    }



    async fn update_status(&self, stage: StartupStage, progress: u8, message: &str, details: &str) {
        let mut status = self.status.lock().unwrap();
        status.stage = stage.clone();
        status.progress = progress;
        status.message = message.to_string();
        status.details = details.to_string();
        
        // Update game_api_ready based on stage
        status.game_api_ready = matches!(stage, StartupStage::GameAPIReady | StartupStage::Ready);

        let status_clone = status.clone();
        drop(status);

        // Emit to frontend
        if let Err(e) = self.app_handle.emit("startup-status", &status_clone) {
            error!("Failed to emit startup status: {}", e);
        }
    }



    pub fn get_status(&self) -> StartupStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn is_ready(&self) -> bool {
        matches!(self.status.lock().unwrap().stage, StartupStage::Ready)
    }

    pub fn get_container_manager(&self) -> Option<Arc<ContainerManager>> {
        self.container_manager.clone()
    }



    async fn ensure_podman_ready(&self) -> BackendResult<()> {
        use crate::container::retry::{retry_with_backoff, RetryConfig};
        
        info!("🔍 Ensuring Podman is ready...");

        // First, check if Podman is already healthy with retries
        let quick_check_result = retry_with_backoff(
            "Podman health check",
            RetryConfig::quick(),
            || async {
                let output = tokio::process::Command::new("podman")
                    .args(["info", "--format", "{{.Host.Arch}}"])
                    .output()
                    .await
                    .map_err(|e| BackendError::Container(format!("Failed to run podman info: {}", e)))?;

                if output.status.success() {
                    Ok(())
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Err(BackendError::Container(format!("Podman not healthy: {}", stderr)))
                }
            },
        )
        .await;

        if quick_check_result.is_ok() {
            info!("✅ Podman is already running and healthy");
            return Ok(());
        }

        // Podman not healthy, try to recover
        info!("⚠️ Podman not responding, attempting recovery...");

        // Check connection status
        let connection_check = tokio::process::Command::new("podman")
            .args(["system", "connection", "list", "--format", "{{.Name}},{{.Default}}"])
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to check connections: {}", e)))?;

        if !connection_check.status.success() {
            // No connections available, try to initialize
            info!("📝 No Podman connections found, initializing machine...");
            
            let init_result = tokio::process::Command::new("podman")
                .args(["machine", "init"])
                .output()
                .await
                .map_err(|e| BackendError::Container(format!("Failed to init Podman machine: {}", e)))?;

            let stderr = String::from_utf8_lossy(&init_result.stderr);
            if !init_result.status.success() && !stderr.contains("already exists") {
                return Err(BackendError::Container(format!(
                    "Failed to initialize Podman machine: {}",
                    stderr
                )));
            }
        }

        // Check machine status
        let machine_check = tokio::process::Command::new("podman")
            .args(["machine", "list", "--format", "{{.Name}},{{.Running}}"])
            .output()
            .await;

        let needs_start = match machine_check {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stdout);
                !output_str.lines().any(|line| line.contains("true"))
            }
            Err(_) => true, // Assume we need to start if we can't check
        };

        // Check and configure memory before starting the machine
        info!("🧠 Checking system memory and Podman machine configuration...");
        let memory_config = MemoryConfig::calculate();
        
        if !memory_config.has_sufficient_memory {
            return Err(BackendError::Container(format!(
                "Insufficient system memory. System has {:.1} GB, but at least 7.5 GB is recommended for running llama3.2:3b model",
                memory_config.total_system_memory_mb as f64 / 1024.0
            )));
        }
        
        // Check if memory adjustment is needed
        if memory_config.needs_memory_adjustment().await? {
            info!("📊 Adjusting Podman machine memory allocation...");
            self.update_status(
                StartupStage::DetectingRuntime,
                15,
                "Configuring memory allocation...",
                &format!(
                    "Setting Podman machine memory to {:.1} GB based on system memory",
                    memory_config.podman_machine_memory_mb as f64 / 1024.0
                ),
            )
            .await;
            
            // Apply the memory configuration
            memory_config.apply_to_podman_machine().await?;
        }

        if needs_start {
            info!("🚀 Starting Podman machine...");
            
            // Try to stop first in case it's in a bad state
            let _ = tokio::process::Command::new("podman")
                .args(["machine", "stop"])
                .output()
                .await;

            // Wait a bit for clean shutdown
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            // Now start the machine with retries
            retry_with_backoff(
                "Podman machine start",
                RetryConfig::podman_recovery(),
                || async {
                    let output = tokio::process::Command::new("podman")
                        .args(["machine", "start"])
                        .output()
                        .await
                        .map_err(|e| BackendError::Container(format!("Failed to run podman machine start: {}", e)))?;

                    let stderr = String::from_utf8_lossy(&output.stderr);
                    
                    // Check if it's already running (not an error)
                    if !output.status.success() && !stderr.contains("already running") {
                        Err(BackendError::Container(format!(
                            "Failed to start Podman machine: {}",
                            stderr
                        )))
                    } else {
                        Ok(())
                    }
                },
            )
            .await?;

            info!("✅ Podman machine started successfully");
            
            // Wait for it to be fully ready
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }

        // Reset the default connection if needed
        info!("🔗 Resetting Podman connection...");
        let reset_result = tokio::process::Command::new("podman")
            .args(["system", "connection", "default", "podman-machine-default"])
            .output()
            .await;

        if let Ok(output) = reset_result {
            if !output.status.success() {
                warn!("Failed to reset default connection: {}", String::from_utf8_lossy(&output.stderr));
            }
        }

        // Final health check with retries
        retry_with_backoff(
            "Final Podman health check",
            RetryConfig::podman_recovery(),
            || async {
                let output = tokio::process::Command::new("podman")
                    .args(["info", "--format", "{{.Host.Arch}}"])
                    .output()
                    .await
                    .map_err(|e| BackendError::Container(format!("Final health check failed: {}", e)))?;

                if !output.status.success() {
                    let error_str = String::from_utf8_lossy(&output.stderr);
                    Err(BackendError::Container(format!(
                        "Podman is not responding after recovery: {}",
                        error_str
                    )))
                } else {
                    Ok(())
                }
            },
        )
        .await?;

        info!("✅ Podman connection verified and ready");
        Ok(())
    }

    async fn ensure_agentserver_image(&self) -> BackendResult<()> {
        info!("🔍 Checking for eliza-agent:latest image...");

        let output = tokio::process::Command::new("podman")
            .args(["image", "exists", "eliza-agent:latest"])
            .output()
            .await
            .map_err(|e| BackendError::Container(format!("Failed to check image: {}", e)))?;

        if output.status.success() {
            info!("✅ eliza-agent:latest image found");
            return Ok(());
        }

        warn!("⚠️ eliza-agent:latest image not found, building...");

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
        
        // First, ensure Podman machine is running before attempting build
        let machine_check = tokio::process::Command::new("podman")
            .args(["system", "connection", "list"])
            .output()
            .await;
            
        if machine_check.is_err() || !machine_check.unwrap().status.success() {
            warn!("⚠️ Cannot connect to Podman, attempting to start machine...");
            
            // Try to list machines
            let machine_list = tokio::process::Command::new("podman")
                .args(["machine", "list", "--format", "json"])
                .output()
                .await;
                
            if let Ok(list_output) = machine_list {
                if list_output.status.success() {
                    // Try to start the default machine
                    let start_result = tokio::process::Command::new("podman")
                        .args(["machine", "start"])
                        .output()
                        .await;
                        
                    if let Ok(start_output) = start_result {
                        if start_output.status.success() {
                            info!("✅ Podman machine started successfully");
                            // Wait for machine to be ready
                            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        } else {
                            warn!("Failed to start Podman machine, attempting to continue anyway");
                        }
                    }
                }
            }
        }
        
        let docker_output = tokio::process::Command::new("podman")
            .args([
                "build",
                "-f",
                "Dockerfile.standalone",
                "-t",
                "eliza-agent:latest",
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

        info!("✅ eliza-agent:latest image built successfully");
        Ok(())
    }


}
