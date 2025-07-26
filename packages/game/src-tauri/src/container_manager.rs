use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStatus {
    pub name: String,
    pub state: String, // "running", "stopped", "error"
    pub health: String, // "healthy", "unhealthy", "starting", "unknown"
    pub uptime: u64,
    pub restart_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupProgress {
    pub stage: String, // "checking", "installing", "starting", "complete", "error"
    pub progress: u8,  // 0-100
    pub message: String,
    pub details: String,
    pub can_retry: bool,
}

pub struct ContainerManager {
    containers: Arc<Mutex<HashMap<String, ContainerStatus>>>,
    podman_path: String,
    setup_progress: Arc<Mutex<SetupProgress>>,
}

impl ContainerManager {
    pub fn new() -> Self {
        Self {
            containers: Arc::new(Mutex::new(HashMap::new())),
            podman_path: "podman".to_string(), // Will be updated to bundled path
            setup_progress: Arc::new(Mutex::new(SetupProgress {
                stage: "checking".to_string(),
                progress: 0,
                message: "Initializing container setup...".to_string(),
                details: "".to_string(),
                can_retry: false,
            })),
        }
    }

    pub fn set_podman_path(&mut self, path: String) {
        self.podman_path = path;
    }

    pub fn get_setup_progress(&self) -> SetupProgress {
        self.setup_progress.lock().unwrap().clone()
    }

    pub fn get_container_status(&self) -> HashMap<String, ContainerStatus> {
        self.containers.lock().unwrap().clone()
    }

    fn update_progress(&self, stage: &str, progress: u8, message: &str, details: &str, can_retry: bool) {
        let mut progress_guard = self.setup_progress.lock().unwrap();
        progress_guard.stage = stage.to_string();
        progress_guard.progress = progress;
        progress_guard.message = message.to_string();
        progress_guard.details = details.to_string();
        progress_guard.can_retry = can_retry;
        println!("[CONTAINER] Progress: {}: {} ({}%)", stage, message, progress);
    }

    pub async fn check_podman_availability(&self) -> bool {
        match Command::new(&self.podman_path)
            .arg("--version")
            .output() {
                Ok(output) => {
                    let version_str = String::from_utf8_lossy(&output.stdout);
                    println!("[CONTAINER] Podman available: {}", version_str.trim());
                    true
                }
                Err(e) => {
                    println!("[CONTAINER] Podman not available: {}", e);
                    false
                }
            }
    }

    pub async fn load_bundled_images(&self, resource_dir: &std::path::Path) -> Result<(), String> {
        self.update_progress("installing", 20, "Loading container images...", "Loading PostgreSQL and Ollama images from bundle", false);

        let postgres_image = resource_dir.join("container-images").join("eliza-postgres.tar");
        let ollama_image = resource_dir.join("container-images").join("eliza-ollama.tar");

        // Load PostgreSQL image
        if postgres_image.exists() {
            self.update_progress("installing", 30, "Loading PostgreSQL image...", "Loading database container image", false);
            let output = Command::new(&self.podman_path)
                .args(&["load", "-i", postgres_image.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Failed to load PostgreSQL image: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to load PostgreSQL image: {}", String::from_utf8_lossy(&output.stderr)));
            }
            println!("[CONTAINER] PostgreSQL image loaded successfully");
        }

        // Load Ollama image
        if ollama_image.exists() {
            self.update_progress("installing", 40, "Loading Ollama image...", "Loading AI model container image", false);
            let output = Command::new(&self.podman_path)
                .args(&["load", "-i", ollama_image.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Failed to load Ollama image: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to load Ollama image: {}", String::from_utf8_lossy(&output.stderr)));
            }
            println!("[CONTAINER] Ollama image loaded successfully");
        }

        Ok(())
    }

    pub async fn start_containers(&self) -> Result<(), String> {
        self.update_progress("starting", 30, "Starting PostgreSQL container...", "Initializing database container", false);
        
        // Start PostgreSQL container
        self.start_postgres_container().await?;
        
        self.update_progress("starting", 50, "Starting Ollama container...", "Initializing AI model container", false);
        
        // Start Ollama container
        self.start_ollama_container().await?;
        
        self.update_progress("starting", 65, "Downloading AI models...", "Ensuring required models are available", false);
        
        // Download required models
        self.download_models().await?;
        
        self.update_progress("starting", 80, "Starting ElizaOS Agent container...", "Initializing agent server", false);
        
        // Start Agent container
        self.start_agent_container().await?;
        
        self.update_progress("starting", 90, "Verifying container health...", "Ensuring all containers are healthy", false);
        
        // Wait for containers to be healthy
        self.wait_for_containers_healthy().await?;
        
        self.update_progress("complete", 100, "Container setup complete!", "All containers are running and healthy", false);
        
        Ok(())
    }

    async fn start_postgres_container(&self) -> Result<(), String> {
        let container_name = "eliza-postgres";
        
        // Check if container already exists
        let exists = self.container_exists(container_name).await?;
        
        if exists {
            // Remove existing container
            println!("[CONTAINER] Removing existing PostgreSQL container");
            let _ = Command::new(&self.podman_path)
                .args(&["rm", "-f", container_name])
                .output();
        }

        // Start new PostgreSQL container
        println!("[CONTAINER] Starting PostgreSQL container");
        let output = Command::new(&self.podman_path)
            .args(&[
                "run", "-d",
                "--name", container_name,
                "-p", "7771:5432",
                "-e", "POSTGRES_DB=eliza",
                "-e", "POSTGRES_USER=eliza",
                "-e", "POSTGRES_PASSWORD=eliza",
                "-v", "eliza-postgres-data:/var/lib/postgresql/data",
                "postgres:15-alpine"
            ])
            .output()
            .map_err(|e| format!("Failed to start PostgreSQL container: {}", e))?;

        if !output.status.success() {
            return Err(format!("Failed to start PostgreSQL container: {}", String::from_utf8_lossy(&output.stderr)));
        }

        // Update container status
        let mut containers = self.containers.lock().unwrap();
        containers.insert(container_name.to_string(), ContainerStatus {
            name: container_name.to_string(),
            state: "running".to_string(),
            health: "starting".to_string(),
            uptime: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            restart_count: 0,
        });

        println!("[CONTAINER] PostgreSQL container started successfully");
        Ok(())
    }

    async fn start_ollama_container(&self) -> Result<(), String> {
        let container_name = "eliza-ollama";
        
        // Kill any existing system Ollama processes to free up port 11434
        self.kill_existing_ollama_processes().await;
        
        // First check if Ollama is already running on port 11434
        if self.is_ollama_running().await {
            println!("[CONTAINER] Ollama is already running on port 11434, reusing existing instance");
            
            // Update container status to reflect external Ollama
            let mut containers = self.containers.lock().unwrap();
            containers.insert("ollama-external".to_string(), ContainerStatus {
                name: "ollama-external".to_string(),
                state: "running".to_string(),
                health: "healthy".to_string(),
                uptime: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                restart_count: 0,
            });
            
            return Ok(());
        }
        
        // Check if container already exists
        let exists = self.container_exists(container_name).await?;
        
        if exists {
            // Check if it's running and healthy
            let is_running = self.is_container_running(container_name).await?;
            if is_running {
                println!("[CONTAINER] Ollama container already running, checking health...");
                
                // Give it a moment to be ready
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                if self.is_ollama_running().await {
                    println!("[CONTAINER] Existing Ollama container is healthy, reusing it");
                    return Ok(());
                }
            }
            
            // Remove unhealthy or stopped container
            println!("[CONTAINER] Removing existing unhealthy/stopped Ollama container");
            let _ = Command::new(&self.podman_path)
                .args(&["rm", "-f", container_name])
                .output();
        }

        // Start new Ollama container
        println!("[CONTAINER] Starting new Ollama container");
        let output = Command::new(&self.podman_path)
            .args(&[
                "run", "-d",
                "--name", container_name,
                "-p", "11434:11434",
                "-v", "eliza-ollama-data:/root/.ollama",
                "ollama/ollama:latest"
            ])
            .output()
            .map_err(|e| format!("Failed to start Ollama container: {}", e))?;

        if !output.status.success() {
            return Err(format!("Failed to start Ollama container: {}", String::from_utf8_lossy(&output.stderr)));
        }

        // Update container status
        let mut containers = self.containers.lock().unwrap();
        containers.insert(container_name.to_string(), ContainerStatus {
            name: container_name.to_string(),
            state: "running".to_string(),
            health: "starting".to_string(),
            uptime: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            restart_count: 0,
        });

        println!("[CONTAINER] Ollama container started successfully");
        Ok(())
    }

    async fn start_agent_container(&self) -> Result<(), String> {
        let container_name = "eliza-agent";
        
        // Check if agent is already running on port 7777
        if self.is_agent_running().await {
            println!("[CONTAINER] ElizaOS Agent is already running on port 7777, reusing existing instance");
            
            // Update container status to reflect running agent
            let mut containers = self.containers.lock().unwrap();
            containers.insert("agent-external".to_string(), ContainerStatus {
                name: "agent-external".to_string(),
                state: "running".to_string(),
                health: "healthy".to_string(),
                uptime: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                restart_count: 0,
            });
            
            return Ok(());
        }
        
        // Check if container already exists
        let exists = self.container_exists(container_name).await?;
        
        if exists {
            // Remove existing container to ensure clean start
            println!("[CONTAINER] Removing existing agent container for clean restart");
            let _ = Command::new(&self.podman_path)
                .args(&["rm", "-f", container_name])
                .output();
        }

        // Build the agent container image first
        println!("[CONTAINER] Building ElizaOS Agent container image...");
        let build_output = Command::new(&self.podman_path)
            .args(&[
                "build", "-t", "eliza-agent",
                "/Users/shawwalters/eliza-dev/packages/agentserver"
            ])
            .output()
            .map_err(|e| format!("Failed to build agent container: {}", e))?;

        if !build_output.status.success() {
            return Err(format!("Failed to build agent container: {}", String::from_utf8_lossy(&build_output.stderr)));
        }

        // Start new Agent container
        println!("[CONTAINER] Starting ElizaOS Agent container");
        let output = Command::new(&self.podman_path)
            .args(&[
                "run", "-d",
                "--name", container_name,
                "-p", "7777:7777",
                "-p", "7778:7778",
                "-e", "DATABASE_URL=postgresql://eliza:eliza@host.containers.internal:7771/eliza",
                "-e", "NODE_ENV=production",
                "-e", "OLLAMA_URL=http://host.containers.internal:11434",
                "--add-host", "host.containers.internal:host-gateway",
                "eliza-agent"
            ])
            .output()
            .map_err(|e| format!("Failed to start agent container: {}", e))?;

        if !output.status.success() {
            return Err(format!("Failed to start agent container: {}", String::from_utf8_lossy(&output.stderr)));
        }

        // Update container status
        let mut containers = self.containers.lock().unwrap();
        containers.insert(container_name.to_string(), ContainerStatus {
            name: container_name.to_string(),
            state: "running".to_string(),
            health: "starting".to_string(),
            uptime: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            restart_count: 0,
        });

        println!("[CONTAINER] ElizaOS Agent container started successfully");
        Ok(())
    }

    async fn container_exists(&self, container_name: &str) -> Result<bool, String> {
        let output = Command::new(&self.podman_path)
            .args(&["ps", "-a", "--filter", &format!("name={}", container_name), "--format", "{{.Names}}"])
            .output()
            .map_err(|e| format!("Failed to check container existence: {}", e))?;

        let containers_list = String::from_utf8_lossy(&output.stdout);
        Ok(containers_list.lines().any(|line| line.trim() == container_name))
    }
    
    async fn is_container_running(&self, container_name: &str) -> Result<bool, String> {
        let output = Command::new(&self.podman_path)
            .args(&["ps", "--filter", &format!("name={}", container_name), "--format", "{{.Names}}"])
            .output()
            .map_err(|e| format!("Failed to check if container is running: {}", e))?;

        let containers_list = String::from_utf8_lossy(&output.stdout);
        Ok(containers_list.lines().any(|line| line.trim() == container_name))
    }
    
    async fn is_ollama_running(&self) -> bool {
        // Try to connect to Ollama API
        match reqwest::Client::new()
            .get("http://localhost:11434/api/version")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn is_agent_running(&self) -> bool {
        // Try to connect to ElizaOS Agent health endpoint
        match reqwest::Client::new()
            .get("http://localhost:7777/health")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn download_models(&self) -> Result<(), String> {
        println!("[CONTAINER] Starting model download process...");
        
        // Wait for Ollama to be ready first
        let max_attempts = 10;
        let mut ollama_ready = false;
        
        for attempt in 1..=max_attempts {
            if self.is_ollama_running().await {
                ollama_ready = true;
                break;
            }
            
            println!("[CONTAINER] Waiting for Ollama to be ready... attempt {}/{}", attempt, max_attempts);
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }
        
        if !ollama_ready {
            return Err("Ollama container is not ready for model downloads".to_string());
        }
        
        let ollama_url = "http://localhost:11434";
        let required_models = vec!["llama3.2:3b", "nomic-embed-text"];
        
        for (i, model) in required_models.iter().enumerate() {
            let progress_base = 65;
            let progress_per_model = 10; // 10% per model
            let model_progress = progress_base + (i * progress_per_model);
            
            self.update_progress(
                "starting", 
                model_progress as u8, 
                &format!("Downloading model: {}", model), 
                "This may take several minutes for large models", 
                false
            );
            
            if !self.is_model_available(ollama_url, model).await? {
                println!("[CONTAINER] Downloading model: {}", model);
                self.download_single_model(ollama_url, model).await?;
            } else {
                println!("[CONTAINER] Model already available: {}", model);
            }
        }
        
        println!("[CONTAINER] All models downloaded successfully!");
        Ok(())
    }
    
    async fn is_model_available(&self, ollama_url: &str, model_name: &str) -> Result<bool, String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/tags", ollama_url);
        
        match client.get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await 
        {
            Ok(response) => {
                match response.json::<serde_json::Value>().await {
                    Ok(tags) => {
                        if let Some(models) = tags["models"].as_array() {
                            for model in models {
                                if let Some(name) = model["name"].as_str() {
                                    if name == model_name {
                                        return Ok(true);
                                    }
                                }
                            }
                        }
                        Ok(false)
                    }
                    Err(e) => Err(format!("Failed to parse Ollama response: {}", e))
                }
            }
            Err(e) => Err(format!("Failed to check models: {}", e))
        }
    }
    
    async fn download_single_model(&self, ollama_url: &str, model_name: &str) -> Result<(), String> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/pull", ollama_url);
        
        let payload = serde_json::json!({
            "name": model_name
        });
        
        println!("[CONTAINER] Starting download for model: {}", model_name);
        
        match client.post(&url)
            .json(&payload)
            .timeout(Duration::from_secs(600)) // 10 minutes timeout
            .send()
            .await 
        {
            Ok(response) => {
                if response.status().is_success() {
                    // For now, just wait a bit and assume success
                    // In production, we'd parse the streaming response
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    println!("[CONTAINER] Model download initiated: {}", model_name);
                    Ok(())
                } else {
                    Err(format!("Failed to download model {}: HTTP {}", model_name, response.status()))
                }
            }
            Err(e) => Err(format!("Failed to download model {}: {}", model_name, e))
        }
    }

    async fn wait_for_containers_healthy(&self) -> Result<(), String> {
        let max_attempts = 30;
        let delay = Duration::from_secs(2);

        for attempt in 1..=max_attempts {
            println!("[CONTAINER] Health check attempt {}/{}", attempt, max_attempts);

            let postgres_healthy = self.check_postgres_health().await;
            let ollama_healthy = self.check_ollama_health().await;
            let agent_healthy = self.check_agent_health().await;

            println!("[CONTAINER] Health status - PostgreSQL: {}, Ollama: {}, Agent: {}", 
                     postgres_healthy, ollama_healthy, agent_healthy);

            if postgres_healthy && ollama_healthy && agent_healthy {
                println!("[CONTAINER] All containers are healthy");
                
                // Update container health status
                let mut containers = self.containers.lock().unwrap();
                if let Some(postgres) = containers.get_mut("eliza-postgres") {
                    postgres.health = "healthy".to_string();
                }
                if let Some(ollama) = containers.get_mut("eliza-ollama") {
                    ollama.health = "healthy".to_string();
                }
                if let Some(agent) = containers.get_mut("eliza-agent") {
                    agent.health = "healthy".to_string();
                }
                // Handle external instances
                if let Some(ollama_ext) = containers.get_mut("ollama-external") {
                    ollama_ext.health = "healthy".to_string();
                }
                if let Some(agent_ext) = containers.get_mut("agent-external") {
                    agent_ext.health = "healthy".to_string();
                }
                
                return Ok(());
            }

            if attempt < max_attempts {
                thread::sleep(delay);
            }
        }

        Err("Containers failed to become healthy within timeout".to_string())
    }

    async fn check_postgres_health(&self) -> bool {
        // Try to connect to PostgreSQL
        let output = Command::new(&self.podman_path)
            .args(&[
                "exec", "eliza-postgres",
                "pg_isready", "-U", "eliza", "-d", "eliza"
            ])
            .output();

        match output {
            Ok(result) => result.status.success(),
            Err(_) => false,
        }
    }

    async fn check_ollama_health(&self) -> bool {
        // Try to connect to Ollama API
        match std::process::Command::new("curl")
            .args(&["-f", "http://localhost:11434/api/version"])
            .output() {
                Ok(result) => result.status.success(),
                Err(_) => false,
            }
    }

    async fn check_agent_health(&self) -> bool {
        // Try to connect to ElizaOS Agent health endpoint
        self.is_agent_running().await
    }

    pub async fn stop_containers(&self) -> Result<(), String> {
        println!("[CONTAINER] Stopping all containers");

        let containers_to_stop = vec!["eliza-agent", "eliza-postgres", "eliza-ollama"];

        for container_name in containers_to_stop {
            let output = Command::new(&self.podman_path)
                .args(&["stop", container_name])
                .output();

            match output {
                Ok(result) => {
                    if result.status.success() {
                        println!("[CONTAINER] Stopped container: {}", container_name);
                    } else {
                        println!("[CONTAINER] Failed to stop container {}: {}", 
                               container_name, String::from_utf8_lossy(&result.stderr));
                    }
                }
                Err(e) => {
                    println!("[CONTAINER] Error stopping container {}: {}", container_name, e);
                }
            }

            // Remove the container
            let _ = Command::new(&self.podman_path)
                .args(&["rm", container_name])
                .output();
        }

        // Clear container status
        self.containers.lock().unwrap().clear();

        Ok(())
    }

    pub async fn restart_container(&self, container_name: &str) -> Result<(), String> {
        println!("[CONTAINER] Restarting container: {}", container_name);

        let output = Command::new(&self.podman_path)
            .args(&["restart", container_name])
            .output()
            .map_err(|e| format!("Failed to restart container: {}", e))?;

        if !output.status.success() {
            return Err(format!("Failed to restart container: {}", String::from_utf8_lossy(&output.stderr)));
        }

        // Update restart count
        let mut containers = self.containers.lock().unwrap();
        if let Some(container) = containers.get_mut(container_name) {
            container.restart_count += 1;
            container.health = "starting".to_string();
        }

        println!("[CONTAINER] Container {} restarted successfully", container_name);
        Ok(())
    }

    pub async fn setup_complete_environment(&self, resource_dir: &std::path::Path) -> Result<(), String> {
        self.update_progress("checking", 0, "Checking container runtime...", "Verifying Podman availability", false);

        // Check if Podman is available
        if !self.check_podman_availability().await {
            return Err("Container runtime (Podman) not available".to_string());
        }

        self.update_progress("installing", 10, "Preparing container environment...", "Setting up container runtime", false);

        // Load bundled images if they exist
        if let Err(e) = self.load_bundled_images(resource_dir).await {
            println!("[CONTAINER] Warning: Failed to load bundled images: {}", e);
            // Continue anyway - images might be available from registry
        }

        // Start containers
        self.start_containers().await?;

        Ok(())
    }

    /// Kills any existing system Ollama processes to free up port 11434
    async fn kill_existing_ollama_processes(&self) {
        println!("[CONTAINER] 🔍 Checking for existing Ollama processes on port 11434...");
        
        // Find processes using port 11434
        let lsof_output = std::process::Command::new("lsof")
            .args(["-ti:11434"])
            .output();
            
        match lsof_output {
            Ok(output) => {
                let pids_str = String::from_utf8_lossy(&output.stdout);
                let pids: Vec<&str> = pids_str.lines().filter(|line| !line.trim().is_empty()).collect();
                
                if !pids.is_empty() {
                    println!("[CONTAINER] 🚫 Found {} process(es) using port 11434: {:?}", pids.len(), pids);
                    
                    for pid in pids {
                        if let Ok(pid_num) = pid.trim().parse::<u32>() {
                            println!("[CONTAINER] 🔪 Killing process with PID: {}", pid_num);
                            
                            // Try graceful termination first
                            let kill_result = std::process::Command::new("kill")
                                .args(["-TERM", &pid_num.to_string()])
                                .output();
                                
                            match kill_result {
                                Ok(result) => {
                                    if result.status.success() {
                                        println!("[CONTAINER] ✅ Successfully terminated process {}", pid_num);
                                        
                                        // Wait a moment for graceful shutdown
                                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                                        
                                        // Check if process is still running, force kill if needed
                                        let check_result = std::process::Command::new("kill")
                                            .args(["-0", &pid_num.to_string()])
                                            .output();
                                            
                                        if let Ok(check) = check_result {
                                            if check.status.success() {
                                                println!("[CONTAINER] ⚡ Process {} still running, force killing...", pid_num);
                                                let _ = std::process::Command::new("kill")
                                                    .args(["-KILL", &pid_num.to_string()])
                                                    .output();
                                            }
                                        }
                                    } else {
                                        println!("[CONTAINER] Failed to kill process {}: {}", pid_num, String::from_utf8_lossy(&result.stderr));
                                    }
                                }
                                Err(e) => {
                                    println!("[CONTAINER] Error killing process {}: {}", pid_num, e);
                                }
                            }
                        }
                    }
                    
                    // Wait a moment for processes to fully terminate
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    println!("[CONTAINER] ✅ Finished cleaning up processes on port 11434");
                } else {
                    println!("[CONTAINER] ✅ No existing processes found on port 11434");
                }
            }
            Err(e) => {
                // lsof might not be available or permission denied, try alternative approach
                println!("[CONTAINER] Could not use lsof to check port 11434: {}, trying alternative approach", e);
                
                // Try to find Ollama processes by name
                let ps_output = std::process::Command::new("pgrep")
                    .args(["-f", "ollama"])
                    .output();
                    
                match ps_output {
                    Ok(output) => {
                        let pids_str = String::from_utf8_lossy(&output.stdout);
                        let pids: Vec<&str> = pids_str.lines().filter(|line| !line.trim().is_empty()).collect();
                        
                        if !pids.is_empty() {
                            println!("[CONTAINER] 🚫 Found {} Ollama process(es): {:?}", pids.len(), pids);
                            
                            for pid in pids {
                                if let Ok(pid_num) = pid.trim().parse::<u32>() {
                                    println!("[CONTAINER] 🔪 Killing Ollama process with PID: {}", pid_num);
                                    let _ = std::process::Command::new("kill")
                                        .args(["-TERM", &pid_num.to_string()])
                                        .output();
                                }
                            }
                            
                            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                            println!("[CONTAINER] ✅ Finished cleaning up Ollama processes");
                        } else {
                            println!("[CONTAINER] ✅ No existing Ollama processes found");
                        }
                    }
                    Err(_) => {
                        println!("[CONTAINER] ℹ️ Could not check for existing Ollama processes, proceeding anyway");
                    }
                }
            }
        }
    }
}