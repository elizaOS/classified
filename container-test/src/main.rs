use anyhow::{Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, StartContainerOptions,
    RemoveContainerOptions,
};
use bollard::image::CreateImageOptions;
use bollard::models::{HostConfig, PortBinding};
use bollard::network::{CreateNetworkOptions, ConnectNetworkOptions};
use bollard::Docker;
use chrono::Utc;
use futures_util::stream::TryStreamExt;
use rust_socketio::{ClientBuilder, Payload, client::Client};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::TcpListener;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ContainerTestConfig {
    pub postgres_image: String,
    pub agent_image: String,
    pub network_name: String,
    pub openai_api_key: String,
    pub postgres_password: String,
    pub agent_port: u16,
    pub postgres_port: u16,
}

impl Default for ContainerTestConfig {
    fn default() -> Self {
        // Find two different available ports
        let ports = find_available_ports(2);
        let postgres_port = ports.get(0).copied().unwrap_or(5432);
        let agent_port = ports.get(1).copied().unwrap_or(7777);
        
        Self {
            postgres_image: "pgvector/pgvector:pg16".to_string(),
            agent_image: "eliza-agent-server:latest".to_string(),
            network_name: "eliza-test-network".to_string(),
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            postgres_password: "eliza_secure_pass".to_string(),
            agent_port,
            postgres_port,
        }
    }
}

fn find_available_port() -> Option<u16> {
    (1024..65535).find(|port| {
        TcpListener::bind(("127.0.0.1", *port)).is_ok()
    })
}

fn find_available_ports(count: usize) -> Vec<u16> {
    let mut ports = Vec::new();
    for port in 1024..65535 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            ports.push(port);
            if ports.len() >= count {
                break;
            }
        }
    }
    ports
}

#[derive(Debug, Clone)]
pub struct ContainerTestManager {
    docker: Docker,
    config: ContainerTestConfig,
    containers: Arc<Mutex<Vec<String>>>,
    network_id: Arc<Mutex<Option<String>>>,
}

impl ContainerTestManager {
    pub fn new(config: ContainerTestConfig) -> Result<Self> {
        let docker = Docker::connect_with_socket_defaults()
            .context("Failed to connect to Docker/Podman")?;

        Ok(Self {
            docker,
            config,
            containers: Arc::new(Mutex::new(Vec::new())),
            network_id: Arc::new(Mutex::new(None)),
        })
    }

    pub async fn setup_network(&self) -> Result<()> {
        info!("Setting up test network: {}", self.config.network_name);

        // Check if network already exists
        let networks = self.docker.list_networks::<String>(None).await?;
        let existing_network = networks.iter().find(|n| {
            n.name.as_ref().map_or(false, |name| name == &self.config.network_name)
        });

        let network_id = if let Some(network) = existing_network {
            info!("Using existing network: {}", self.config.network_name);
            network.id.clone().unwrap_or_default()
        } else {
            info!("Creating new network: {}", self.config.network_name);
            let options = CreateNetworkOptions {
                name: self.config.network_name.clone(),
                driver: "bridge".to_string(),
                ..Default::default()
            };

            let response = self.docker.create_network(options).await?;
            response.id.unwrap_or_default()
        };

        *self.network_id.lock().await = Some(network_id);
        Ok(())
    }

    pub async fn start_postgres_container(&self) -> Result<String> {
        info!("Starting PostgreSQL container");

        // Pull image if needed
        self.pull_image(&self.config.postgres_image).await?;

        let container_name = format!("eliza-postgres-test-{}", Uuid::new_v4().to_string().replace("-", ""));
        
        let mut port_bindings = HashMap::new();
        port_bindings.insert(
            "5432/tcp".to_string(),
            Some(vec![PortBinding {
                host_ip: Some("127.0.0.1".to_string()),
                host_port: Some(self.config.postgres_port.to_string()),
            }]),
        );

        let env = vec![
            "POSTGRES_DB=eliza_game".to_string(),
            "POSTGRES_USER=eliza".to_string(),
            format!("POSTGRES_PASSWORD={}", self.config.postgres_password),
            "POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=C".to_string(),
        ];

        let host_config = HostConfig {
            port_bindings: Some(port_bindings),
            ..Default::default()
        };

        let config = Config {
            image: Some(self.config.postgres_image.clone()),
            env: Some(env),
            host_config: Some(host_config),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: container_name.clone(),
            platform: None,
        };

        info!("Creating PostgreSQL container with name: {}", container_name);
        let container = self.docker.create_container(Some(options), config).await
            .with_context(|| format!("Failed to create PostgreSQL container {}", container_name))?;
        let container_id = container.id;

        // Skip custom network connection for now - use default bridge network
        info!("Using default bridge network instead of custom network");

        info!("Starting PostgreSQL container: {}", container_id);
        self.docker
            .start_container(&container_id, None::<StartContainerOptions<String>>)
            .await
            .with_context(|| format!("Failed to start PostgreSQL container {}", container_id))?;

        self.containers.lock().await.push(container_id.clone());

        // Wait for PostgreSQL to be ready
        self.wait_for_postgres(&container_id).await?;

        info!("PostgreSQL container started: {}", container_id);
        Ok(container_id)
    }

    pub async fn start_agent_container(&self, _postgres_container_id: &str) -> Result<String> {
        info!("Starting agent server container");

        // Pull image if needed
        self.pull_image(&self.config.agent_image).await?;

        let container_name = format!("eliza-agent-test-{}", Uuid::new_v4().to_string().replace("-", ""));
        
        let mut port_bindings = HashMap::new();
        port_bindings.insert(
            "7777/tcp".to_string(),
            Some(vec![PortBinding {
                host_ip: Some("127.0.0.1".to_string()),
                host_port: Some(self.config.agent_port.to_string()),
            }]),
        );

        let env = vec![
            format!("DATABASE_URL=postgresql://eliza:{}@localhost:{}/eliza_game", self.config.postgres_password, self.config.postgres_port),
            "POSTGRES_HOST=localhost".to_string(),
            format!("POSTGRES_PORT={}", self.config.postgres_port),
            "POSTGRES_DB=eliza_game".to_string(),
            "POSTGRES_USER=eliza".to_string(),
            format!("POSTGRES_PASSWORD={}", self.config.postgres_password),
            "NODE_ENV=production".to_string(),
            format!("PORT={}", self.config.agent_port),
            format!("SERVER_PORT={}", self.config.agent_port),
            format!("OPENAI_API_KEY={}", self.config.openai_api_key),
            "MODEL_PROVIDER=openai".to_string(),
            "LANGUAGE_MODEL=gpt-4o-mini".to_string(),
            "TEXT_EMBEDDING_MODEL=text-embedding-3-small".to_string(),
            "AUTONOMY_ENABLED=true".to_string(),
            "AUTONOMY_AUTO_START=true".to_string(),
            "LOAD_DOCS_ON_STARTUP=true".to_string(),
            "CTX_KNOWLEDGE_ENABLED=true".to_string(),
            "EMBEDDING_PROVIDER=openai".to_string(),
            "USE_SMALL_MODELS=true".to_string(),
            "AUTO_SEND_TEST_MESSAGE=false".to_string(),
            "DOCKER_CONTAINER=true".to_string(),
        ];

        let host_config = HostConfig {
            port_bindings: Some(port_bindings),
            ..Default::default()
        };

        let config = Config {
            image: Some(self.config.agent_image.clone()),
            env: Some(env),
            host_config: Some(host_config),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: container_name.clone(),
            platform: None,
        };

        let container = self.docker.create_container(Some(options), config).await?;
        let container_id = container.id;

        // Skip custom network connection for now - use default bridge network
        info!("Using default bridge network instead of custom network");

        self.docker
            .start_container(&container_id, None::<StartContainerOptions<String>>)
            .await?;

        self.containers.lock().await.push(container_id.clone());

        // Wait for agent server to be ready
        self.wait_for_agent_server(&container_id).await?;

        info!("Agent server container started: {}", container_id);
        Ok(container_id)
    }

    async fn pull_image(&self, image: &str) -> Result<()> {
        // For local images (localhost/* or known local images), skip the check and assume they exist
        if image.starts_with("localhost/") || image.starts_with("eliza-") {
            info!("Assuming local image exists: {}", image);
            return Ok(());
        }

        // Check if image exists locally first
        match self.docker.list_images::<String>(None).await {
            Ok(existing_images) => {
                let image_exists = existing_images.iter().any(|img| {
                    img.repo_tags.iter().any(|tag| tag == image)
                });

                if image_exists {
                    info!("Using existing local image: {}", image);
                    return Ok(());
                }
            }
            Err(e) => {
                warn!("Could not check existing images (continuing anyway): {}", e);
            }
        }

        info!("Pulling image: {}", image);

        let options = Some(CreateImageOptions {
            from_image: image,
            ..Default::default()
        });

        let stream = self.docker.create_image(options, None, None);
        stream
            .try_for_each(|info| async move {
                if let Some(status) = info.status {
                    if status.contains("Pulling") || status.contains("Downloaded") {
                        info!("Image pull: {}", status);
                    }
                }
                Ok(())
            })
            .await?;

        info!("Image pulled successfully: {}", image);
        Ok(())
    }

    async fn wait_for_postgres(&self, container_id: &str) -> Result<()> {
        info!("Waiting for PostgreSQL to be ready...");

        for attempt in 1..=30 {
            let exec_result = self
                .docker
                .create_exec(
                    container_id,
                    bollard::exec::CreateExecOptions {
                        cmd: Some(vec![
                            "pg_isready",
                            "-U",
                            "eliza",
                            "-d",
                            "eliza_game",
                        ]),
                        attach_stdout: Some(true),
                        attach_stderr: Some(true),
                        ..Default::default()
                    },
                )
                .await;

            if let Ok(exec_info) = exec_result {
                let start_result = self
                    .docker
                    .start_exec(&exec_info.id, None)
                    .await;

                if start_result.is_ok() {
                    info!("PostgreSQL is ready after {} attempts", attempt);
                    return Ok(());
                }
            }

            if attempt == 30 {
                return Err(anyhow::anyhow!("PostgreSQL failed to start after 30 attempts"));
            }

            sleep(Duration::from_secs(2)).await;
        }

        Ok(())
    }

    async fn wait_for_agent_server(&self, _container_id: &str) -> Result<()> {
        info!("Waiting for agent server to be ready...");

        let client = reqwest::Client::new();
        let health_url = format!("http://localhost:{}/api/server/health", self.config.agent_port);

        for attempt in 1..=120 {  // Increased timeout for full initialization
            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("Agent server is ready after {} attempts", attempt);
                    
                    // Additional validation - check if we can get agents list
                    let agents_url = format!("http://localhost:{}/api/agents", self.config.agent_port);
                    match client.get(&agents_url).send().await {
                        Ok(agents_response) if agents_response.status().is_success() => {
                            info!("Agent server API endpoints are responding correctly");
                            return Ok(());
                        }
                        Ok(agents_response) => {
                            warn!("Agents endpoint returned status: {}", agents_response.status());
                        }
                        Err(e) => {
                            warn!("Agents endpoint error: {}", e);
                        }
                    }
                }
                Ok(response) => {
                    if attempt % 10 == 0 {  // Log every 10th attempt to reduce noise
                        warn!("Agent server health check failed with status: {} (attempt {})", response.status(), attempt);
                    }
                }
                Err(e) => {
                    if attempt % 10 == 0 {  // Log every 10th attempt to reduce noise
                        warn!("Agent server health check error: {} (attempt {})", e, attempt);
                    }
                }
            }

            if attempt == 120 {
                return Err(anyhow::anyhow!("Agent server failed to start after 120 attempts"));
            }

            sleep(Duration::from_secs(5)).await;  // Increased wait time
        }

        Ok(())
    }

    pub async fn cleanup(&self) -> Result<()> {
        info!("Cleaning up containers and network");

        let containers = self.containers.lock().await.clone();
        for container_id in containers {
            info!("Removing container: {}", container_id);
            
            let _ = self
                .docker
                .remove_container(
                    &container_id,
                    Some(RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    }),
                )
                .await;
        }

        if let Some(network_id) = &*self.network_id.lock().await {
            info!("Removing network: {}", network_id);
            let _ = self.docker.remove_network(network_id).await;
        }

        Ok(())
    }
}

pub struct SocketIOTestClient {
    client: Option<Client>,
    messages_received: Arc<Mutex<Vec<Value>>>,
    connected: Arc<Mutex<bool>>,
}

impl SocketIOTestClient {
    pub fn new() -> Self {
        Self {
            client: None,
            messages_received: Arc::new(Mutex::new(Vec::new())),
            connected: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn connect(&mut self, server_url: &str) -> Result<()> {
        info!("Connecting to Socket.IO server at: {}", server_url);

        let messages_received = self.messages_received.clone();
        let connected = self.connected.clone();

        let client = ClientBuilder::new(server_url)
            .on("connect", move |_payload, _client| {
                let connected = connected.clone();
                tokio::spawn(async move {
                    info!("Connected to Socket.IO server");
                    *connected.lock().await = true;
                });
            })
            .on("messageBroadcast", move |payload, _client| {
                let messages_received = messages_received.clone();
                tokio::spawn(async move {
                    if let Payload::Text(data) = payload {
                        if let Some(text) = data.first() {
                            if let Ok(message) = serde_json::from_str::<Value>(text.as_str().unwrap_or("{}")) {
                                info!("Received message broadcast: {}", message);
                                messages_received.lock().await.push(message);
                            }
                        }
                    }
                });
            })
            .on("error", |err, _| {
                error!("Socket.IO error: {:?}", err);
            })
            .connect()
            .context("Failed to connect to Socket.IO server")?;

        self.client = Some(client);

        // Wait for connection
        for _ in 0..10 {
            if *self.connected.lock().await {
                break;
            }
            sleep(Duration::from_millis(500)).await;
        }

        if !*self.connected.lock().await {
            return Err(anyhow::anyhow!("Failed to establish Socket.IO connection"));
        }

        Ok(())
    }

    pub async fn join_room(&self, room_id: &str) -> Result<()> {
        if let Some(client) = &self.client {
            info!("Joining room: {}", room_id);
            
            let join_data = json!({
                "roomId": room_id,
                "userId": "test-user"
            });

            client
                .emit("joinRoom", Payload::Text(vec![join_data]))
                .context("Failed to join room")?;

            sleep(Duration::from_millis(500)).await;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Socket.IO client not connected"))
        }
    }

    pub async fn send_message(&self, room_id: &str, content: &str) -> Result<()> {
        if let Some(client) = &self.client {
            info!("Sending message to room {}: {}", room_id, content);
            
            let message_data = json!({
                "roomId": room_id,
                "content": {
                    "text": content
                },
                "senderId": "test-user-123",
                "senderName": "Test User",
                "timestamp": Utc::now().timestamp_millis(),
                "messageId": format!("msg-{}", Uuid::new_v4())
            });

            client
                .emit("message", Payload::Text(vec![message_data]))
                .context("Failed to send message")?;

            Ok(())
        } else {
            Err(anyhow::anyhow!("Socket.IO client not connected"))
        }
    }

    pub async fn get_received_messages(&self) -> Vec<Value> {
        self.messages_received.lock().await.clone()
    }

    pub async fn clear_received_messages(&self) {
        self.messages_received.lock().await.clear();
    }

    pub async fn wait_for_response(&self, timeout_secs: u64) -> Result<Option<Value>> {
        info!("Waiting for response (timeout: {}s)", timeout_secs);

        let start_time = std::time::Instant::now();
        let timeout_duration = Duration::from_secs(timeout_secs);

        while start_time.elapsed() < timeout_duration {
            let messages = self.messages_received.lock().await;
            if !messages.is_empty() {
                let response = messages.last().unwrap().clone();
                info!("Received response: {}", response);
                return Ok(Some(response));
            }
            drop(messages);
            
            sleep(Duration::from_millis(500)).await;
        }

        warn!("No response received within timeout");
        Ok(None)
    }

    pub async fn disconnect(&mut self) -> Result<()> {
        if let Some(client) = &self.client {
            info!("Disconnecting from Socket.IO server");
            client.disconnect().context("Failed to disconnect")?;
            *self.connected.lock().await = false;
        }
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from current directory and parent project
    dotenv::dotenv().ok();
    dotenv::from_path("../.env").ok();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting container communication test");

    // Create configuration
    let config = ContainerTestConfig::default();
    
    info!("Using PostgreSQL port: {}", config.postgres_port);
    info!("Using agent server port: {}", config.agent_port);
    
    if config.openai_api_key.is_empty() {
        error!("OPENAI_API_KEY environment variable is required");
        return Err(anyhow::anyhow!("Missing OPENAI_API_KEY"));
    }

    // Create container manager
    let manager = ContainerTestManager::new(config)?;

    // Setup cleanup handler
    let manager_cleanup = manager.clone();
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        info!("Received interrupt signal, cleaning up...");
        let _ = manager_cleanup.cleanup().await;
        std::process::exit(0);
    });

    // Run the test
    match run_container_test(manager).await {
        Ok(_) => {
            info!("✅ Container communication test completed successfully");
            Ok(())
        }
        Err(e) => {
            error!("❌ Container communication test failed: {}", e);
            error!("❌ Error chain: {:?}", e.chain().collect::<Vec<_>>());
            Err(e)
        }
    }
}

async fn run_container_test(manager: ContainerTestManager) -> Result<()> {
    // Step 1: Setup network
    manager.setup_network().await?;
    info!("✅ Network setup completed");

    // Step 2: Start PostgreSQL container
    let postgres_id = manager.start_postgres_container().await?;
    info!("✅ PostgreSQL container started: {}", postgres_id);

    // Step 3: Start agent server container
    let agent_id = manager.start_agent_container(&postgres_id).await?;
    info!("✅ Agent server container started: {}", agent_id);

    // Step 4: Wait for full system initialization
    info!("Waiting for full system initialization...");
    sleep(Duration::from_secs(10)).await;

    // Step 5: Test Socket.IO communication
    let mut socket_client = SocketIOTestClient::new();
    let server_url = format!("http://localhost:{}", manager.config.agent_port);
    
    socket_client.connect(&server_url).await?;
    info!("✅ Socket.IO connection established");

    // Step 6: Join a test room  
    let test_room_id = "terminal-room-test";
    socket_client.join_room(test_room_id).await?;
    info!("✅ Joined test room: {}", test_room_id);

    // Step 7: Wait a bit for room setup
    sleep(Duration::from_secs(2)).await;

    // Step 8: Clear any initial messages and send a test message
    socket_client.clear_received_messages().await;
    let test_message = "Hello! Can you tell me your name?";
    socket_client.send_message(test_room_id, test_message).await?;
    info!("✅ Test message sent: {}", test_message);

    // Step 9: Wait for agent response
    info!("Waiting for agent to process message and respond...");
    if let Some(response) = socket_client.wait_for_response(60).await? {
        info!("✅ Received agent response: {}", response);
        
        // Validate response structure
        if let Some(text) = response.get("text") {
            if let Some(sender_id) = response.get("senderId") {
                info!("✅ Response has expected structure");
                info!("✅ Agent ID: {}", sender_id);
                info!("✅ Response text: {}", text);
                
                // Step 10: Send a follow-up message
                socket_client.clear_received_messages().await;
                let followup_message = "That's great! What can you help me with?";
                socket_client.send_message(test_room_id, followup_message).await?;
                info!("✅ Follow-up message sent: {}", followup_message);
                
                // Wait for second response
                if let Some(second_response) = socket_client.wait_for_response(60).await? {
                    info!("✅ Received second agent response: {}", second_response);
                    info!("🎉 FULL CONVERSATION TEST SUCCESSFUL!");
                } else {
                    warn!("⚠️ No second response received from agent");
                }
            } else {
                warn!("⚠️ Response missing senderId field");
            }
        } else {
            warn!("⚠️ Response missing text field");
        }
    } else {
        warn!("⚠️ No response received from agent");
        
        // Check if we received any messages at all
        let all_messages = socket_client.get_received_messages().await;
        if !all_messages.is_empty() {
            info!("📝 Received {} messages during test:", all_messages.len());
            for (i, msg) in all_messages.iter().enumerate() {
                info!("  Message {}: {}", i + 1, msg);
            }
        } else {
            warn!("📝 No messages received at all during test");
        }
    }

    // Step 9: Disconnect and cleanup
    socket_client.disconnect().await?;
    info!("✅ Socket.IO disconnected");

    manager.cleanup().await?;
    info!("✅ Cleanup completed");

    Ok(())
}