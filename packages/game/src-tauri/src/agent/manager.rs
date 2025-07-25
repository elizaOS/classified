use crate::backend::{AgentConfig, BackendResult, BackendError};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tracing::{info, warn, error};
use uuid::Uuid;

/// Agent process management
pub struct AgentProcess {
    pub config: AgentConfig,
    pub process: Option<Child>,
    pub status: AgentStatus,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum AgentStatus {
    Starting,
    Running,
    Stopped,
    Failed(String),
}

/// Central agent management system
pub struct AgentManager {
    agents: Arc<Mutex<HashMap<Uuid, AgentProcess>>>,
    message_sender: mpsc::UnboundedSender<AgentMessage>,
    message_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<AgentMessage>>>>,
}

#[derive(Debug, Clone)]
pub struct AgentMessage {
    pub agent_id: Uuid,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>, 
}

impl AgentManager {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        
        Self {
            agents: Arc::new(Mutex::new(HashMap::new())),
            message_sender: tx,
            message_receiver: Arc::new(Mutex::new(Some(rx))),
        }
    }

    /// Start a new agent with the given configuration
    pub async fn start_agent(&self, config: AgentConfig) -> BackendResult<Uuid> {
        info!("Starting agent: {}", config.name);

        let agent_id = config.id;
        
        // Create the ElizaOS agent process
        let process = self.create_agent_process(&config).await?;
        
        let agent_process = AgentProcess {
            config: config.clone(),
            process: Some(process),
            status: AgentStatus::Starting,
        };

        // Store the agent
        {
            let mut agents = self.agents.lock().unwrap();
            agents.insert(agent_id, agent_process);
        }

        // Monitor the agent process
        self.monitor_agent(agent_id).await;

        info!("Agent {} started successfully", config.name);
        Ok(agent_id)
    }

    /// Stop an agent
    pub async fn stop_agent(&self, agent_id: Uuid) -> BackendResult<()> {
        info!("Stopping agent: {}", agent_id);

        let mut agents = self.agents.lock().unwrap();
        if let Some(agent) = agents.get_mut(&agent_id) {
            if let Some(ref mut process) = agent.process {
                match process.kill() {
                    Ok(()) => {
                        info!("Agent {} stopped successfully", agent_id);
                        agent.status = AgentStatus::Stopped;
                        agent.process = None;
                    }
                    Err(e) => {
                        error!("Failed to stop agent {}: {}", agent_id, e);
                        return Err(BackendError::AgentProcess(format!("Failed to stop agent: {}", e)));
                    }
                }
            } else {
                warn!("Agent {} was not running", agent_id);
            }
        } else {
            return Err(BackendError::AgentProcess(format!("Agent {} not found", agent_id)));
        }

        Ok(())
    }

    /// Send a message to an agent
    pub async fn send_message(&self, agent_id: Uuid, message: String) -> BackendResult<()> {
        info!("Sending message to agent {}: {}", agent_id, message);

        // Check agent status without holding lock across await
        let agent_exists = {
            let agents = self.agents.lock().unwrap();
            if let Some(agent) = agents.get(&agent_id) {
                agent.process.is_some() && matches!(agent.status, AgentStatus::Running)
            } else {
                false
            }
        };

        if agent_exists {
            // Send message via IPC/HTTP to the agent process
            // For now, we'll use HTTP to the agent's API
            let client = reqwest::Client::new();
            let agent_url = format!("http://localhost:7777/api/agents/{}/message", agent_id);
            
            match client
                .post(&agent_url)
                .json(&serde_json::json!({
                    "text": message,
                    "timestamp": chrono::Utc::now().timestamp()
                }))
                .send()
                .await
                {
                    Ok(response) => {
                        if response.status().is_success() {
                            info!("Message sent successfully to agent {}", agent_id);
                        } else {
                            error!("Agent {} returned error: {}", agent_id, response.status());
                            return Err(BackendError::AgentProcess(format!(
                                "Agent returned error: {}", 
                                response.status()
                            )));
                        }
                    }
                    Err(e) => {
                        error!("Failed to send message to agent {}: {}", agent_id, e);
                        return Err(BackendError::AgentProcess(format!(
                            "Failed to send message: {}", 
                            e
                        )));
                    }
                }
        } else {
            return Err(BackendError::AgentProcess(format!("Agent {} not found or not running", agent_id)));
        }

        Ok(())
    }

    /// Stop all agents
    pub async fn stop_all_agents(&self) -> BackendResult<()> {
        info!("Stopping all agents");
        
        let agent_ids: Vec<Uuid> = {
            let agents = self.agents.lock().unwrap();
            agents.keys().cloned().collect()
        };

        for agent_id in agent_ids {
            if let Err(e) = self.stop_agent(agent_id).await {
                error!("Failed to stop agent {}: {}", agent_id, e);
            }
        }

        info!("All agents stopped");
        Ok(())
    }

    /// Get the status of all agents
    pub fn get_agent_status(&self) -> HashMap<Uuid, AgentStatus> {
        let agents = self.agents.lock().unwrap();
        agents
            .iter()
            .map(|(id, agent)| (*id, agent.status.clone()))
            .collect()
    }

    /// Get detailed information about a specific agent
    pub fn get_agent_info(&self, agent_id: Uuid) -> Option<(AgentConfig, AgentStatus)> {
        let agents = self.agents.lock().unwrap();
        agents
            .get(&agent_id)
            .map(|agent| (agent.config.clone(), agent.status.clone()))
    }

    /// Create the actual ElizaOS agent process
    async fn create_agent_process(&self, config: &AgentConfig) -> BackendResult<Child> {
        info!("Creating ElizaOS agent process for: {}", config.name);

        // Build the command to start the ElizaOS agent
        let mut cmd = Command::new("node");
        
        // Use the ElizaOS CLI to start the agent
        cmd.arg("-e")
            .arg(format!(r#"
                const {{ AgentRuntime }} = require('@elizaos/core');
                const {{ elizaPlugin }} = require('@elizaos/plugin-bootstrap');
                
                const character = {};
                
                async function startAgent() {{
                    const runtime = new AgentRuntime({{
                        character,
                        plugins: [elizaPlugin],
                        actions: [],
                        providers: [],
                        evaluators: []
                    }});
                    
                    await runtime.initialize();
                    console.log('Agent started: {}');
                    
                    // Keep the process alive
                    process.on('SIGTERM', () => {{
                        console.log('Agent shutting down gracefully');
                        process.exit(0);
                    }});
                }}
                
                startAgent().catch(console.error);
            "#, 
            serde_json::to_string(&config.settings).unwrap_or_default(),
            config.name
        ))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("AGENT_ID", config.id.to_string())
            .env("AGENT_NAME", &config.name);

        // Add character file if specified
        if let Some(ref character_file) = config.character_file {
            cmd.env("CHARACTER_FILE", character_file);
        }

        // Add plugins
        if !config.plugins.is_empty() {
            cmd.env("PLUGINS", config.plugins.join(","));
        }

        match cmd.spawn() {
            Ok(child) => {
                info!("Agent process spawned successfully: {}", config.name);
                Ok(child)
            }
            Err(e) => {
                error!("Failed to spawn agent process: {}", e);
                Err(BackendError::AgentProcess(format!("Failed to spawn process: {}", e)))
            }
        }
    }

    /// Monitor an agent process for health and status updates
    async fn monitor_agent(&self, agent_id: Uuid) {
        info!("Starting agent monitor for: {}", agent_id);

        // In a real implementation, this would:
        // 1. Monitor the process health
        // 2. Handle process crashes and restarts
        // 3. Monitor agent performance metrics
        // 4. Handle agent communication
        
        // For now, we'll mark the agent as running after a brief delay
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        {
            let mut agents = self.agents.lock().unwrap();
            if let Some(agent) = agents.get_mut(&agent_id) {
                // Check if process is still alive
                if let Some(ref mut process) = agent.process {
                    match process.try_wait() {
                        Ok(Some(_exit_status)) => {
                            // Process has exited
                            agent.status = AgentStatus::Failed("Process exited unexpectedly".to_string());
                            error!("Agent {} process exited unexpectedly", agent_id);
                        }
                        Ok(None) => {
                            // Process is still running
                            agent.status = AgentStatus::Running;
                            info!("Agent {} is running successfully", agent_id);
                        }
                        Err(e) => {
                            // Error checking process status
                            agent.status = AgentStatus::Failed(format!("Process check failed: {}", e));
                            error!("Failed to check agent {} process status: {}", agent_id, e);
                        }
                    }
                } else {
                    agent.status = AgentStatus::Failed("No process found".to_string());
                }
            }
        }
    }

    /// Clean up stopped or failed agents
    pub async fn cleanup_agents(&self) {
        let mut agents = self.agents.lock().unwrap();
        agents.retain(|id, agent| {
            match &agent.status {
                AgentStatus::Stopped | AgentStatus::Failed(_) => {
                    info!("Cleaning up agent: {}", id);
                    false
                }
                _ => true
            }
        });
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}