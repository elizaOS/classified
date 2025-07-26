use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{debug, error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: String,
    pub content: String,
    pub author: String,
    pub timestamp: u64,
    pub channel_id: Option<String>,
    pub message_type: String,
}

#[derive(Debug, Clone)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed(String),
}

pub struct NativeWebSocketClient {
    app_handle: AppHandle,
    connection_state: Arc<RwLock<ConnectionState>>,
    sender: Arc<Mutex<Option<mpsc::UnboundedSender<Message>>>>,
    agent_id: String,
    channel_id: String,
    reconnect_attempts: Arc<Mutex<u32>>,
    max_reconnect_attempts: u32,
}

impl NativeWebSocketClient {
    pub fn new(app_handle: AppHandle, agent_id: String) -> Self {
        let channel_id = "e292bdf2-0baa-4677-a3a6-9426672ce6d8".to_string(); // Game UI channel

        Self {
            app_handle,
            connection_state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            sender: Arc::new(Mutex::new(None)),
            agent_id,
            channel_id,
            reconnect_attempts: Arc::new(Mutex::new(0)),
            max_reconnect_attempts: 5,
        }
    }

    pub async fn connect(&self, url: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("🔌 Connecting to WebSocket at {}", url);

        // Update connection state
        *self.connection_state.write().await = ConnectionState::Connecting;

        // Parse WebSocket URL - convert HTTP to WS if needed and use correct port
        let ws_url = if url.starts_with("http://localhost:7777") {
            // For AgentServer, WebSocket is on port 7777
            "ws://localhost:7777/ws".to_string()
        } else if url.starts_with("http://") {
            url.replace("http://", "ws://") + "/ws"
        } else if url.starts_with("https://") {
            url.replace("https://", "wss://") + "/ws"
        } else {
            url.to_string()
        };

        info!("📡 Attempting WebSocket connection to: {}", ws_url);

        match connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                info!("✅ WebSocket connection established");
                *self.connection_state.write().await = ConnectionState::Connected;
                *self.reconnect_attempts.lock().await = 0;

                let (mut ws_sender, mut ws_receiver) = ws_stream.split();
                let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

                // Store sender for outgoing messages
                *self.sender.lock().await = Some(tx);

                // Send initial connection message to agent server (matching WebSocket server format)
                let connect_msg = serde_json::json!({
                    "type": "connect",
                    "agent_id": self.agent_id,
                    "channel_id": self.channel_id,
                    "client_type": "eliza_game",
                    "timestamp": chrono::Utc::now().timestamp_millis()
                });

                if let Err(e) = ws_sender.send(Message::Text(connect_msg.to_string())).await {
                    error!("Failed to send connect message: {}", e);
                }

                // Spawn task to handle outgoing messages
                let sender_task = {
                    let connection_state = self.connection_state.clone();
                    tokio::spawn(async move {
                        while let Some(message) = rx.recv().await {
                            if let Err(e) = ws_sender.send(message).await {
                                error!("Failed to send WebSocket message: {}", e);
                                *connection_state.write().await =
                                    ConnectionState::Failed(e.to_string());
                                break;
                            }
                        }
                    })
                };

                // Spawn task to handle incoming messages
                let receiver_task = {
                    let app_handle = self.app_handle.clone();
                    let connection_state = self.connection_state.clone();
                    tokio::spawn(async move {
                        while let Some(msg) = ws_receiver.next().await {
                            match msg {
                                Ok(Message::Text(text)) => {
                                    debug!("📨 Received WebSocket message: {}", text);

                                    // Parse the JSON message to determine its type
                                    if let Ok(parsed_msg) =
                                        serde_json::from_str::<serde_json::Value>(&text)
                                    {
                                        let msg_type = parsed_msg
                                            .get("type")
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("unknown");

                                        match msg_type {
                                            "welcome" => {
                                                info!("🎉 Welcome message received from WebSocket server");
                                                if let Err(e) = app_handle
                                                    .emit("websocket-connected", parsed_msg)
                                                {
                                                    error!(
                                                        "Failed to emit connection status: {}",
                                                        e
                                                    );
                                                }
                                            }
                                            "connect_ack" => {
                                                info!("✅ Connection acknowledged by WebSocket server");
                                                if let Err(e) = app_handle
                                                    .emit("websocket-registered", parsed_msg)
                                                {
                                                    error!(
                                                        "Failed to emit registration status: {}",
                                                        e
                                                    );
                                                }
                                            }
                                            "agent_message" | "agent_response" => {
                                                // Handle agent messages - convert to AgentMessage format
                                                let agent_msg = AgentMessage {
                                                    id: parsed_msg
                                                        .get("id")
                                                        .and_then(|i| i.as_str())
                                                        .unwrap_or("unknown")
                                                        .to_string(),
                                                    content: parsed_msg
                                                        .get("content")
                                                        .or(parsed_msg.get("text"))
                                                        .and_then(|c| c.as_str())
                                                        .unwrap_or("")
                                                        .to_string(),
                                                    author: parsed_msg
                                                        .get("senderName")
                                                        .or(parsed_msg.get("author"))
                                                        .and_then(|a| a.as_str())
                                                        .unwrap_or("ELIZA")
                                                        .to_string(),
                                                    timestamp: parsed_msg
                                                        .get("timestamp")
                                                        .or(parsed_msg.get("createdAt"))
                                                        .and_then(|t| t.as_u64())
                                                        .unwrap_or(0),
                                                    channel_id: parsed_msg
                                                        .get("channelId")
                                                        .or(parsed_msg.get("channel_id"))
                                                        .and_then(|c| c.as_str())
                                                        .map(|s| s.to_string()),
                                                    message_type: msg_type.to_string(),
                                                };

                                                info!(
                                                    "🤖 Agent message received: {}",
                                                    agent_msg
                                                        .content
                                                        .chars()
                                                        .take(50)
                                                        .collect::<String>()
                                                );

                                                // Emit to frontend
                                                if let Err(e) =
                                                    app_handle.emit("agent-message", &agent_msg)
                                                {
                                                    error!("Failed to emit agent message to frontend: {}", e);
                                                }
                                            }
                                            "user_message" => {
                                                // User messages are echoed back from server - ignore them
                                                // as we already display them immediately in the UI
                                                debug!("📨 Ignoring user message echo from server");
                                            }
                                            "message_received" => {
                                                info!("✅ Message acknowledgment received");
                                                if let Err(e) = app_handle
                                                    .emit("message-acknowledged", parsed_msg)
                                                {
                                                    error!(
                                                        "Failed to emit message acknowledgment: {}",
                                                        e
                                                    );
                                                }
                                            }
                                            "error" => {
                                                error!(
                                                    "❌ WebSocket server error: {}",
                                                    parsed_msg
                                                        .get("message")
                                                        .and_then(|m| m.as_str())
                                                        .unwrap_or("Unknown error")
                                                );
                                                if let Err(e) =
                                                    app_handle.emit("websocket-error", parsed_msg)
                                                {
                                                    error!("Failed to emit WebSocket error: {}", e);
                                                }
                                            }
                                            _ => {
                                                debug!(
                                                    "📄 Unknown message type '{}': {}",
                                                    msg_type, text
                                                );
                                                if let Err(e) =
                                                    app_handle.emit("websocket-message", parsed_msg)
                                                {
                                                    error!("Failed to emit raw message to frontend: {}", e);
                                                }
                                            }
                                        }
                                    } else {
                                        // Fallback for unparseable messages
                                        debug!("📄 Unparseable message: {}", text);
                                        if let Err(e) = app_handle.emit("websocket-message", text) {
                                            error!("Failed to emit raw message to frontend: {}", e);
                                        }
                                    }
                                }
                                Ok(Message::Binary(data)) => {
                                    debug!("📦 Received binary message: {} bytes", data.len());
                                }
                                Ok(Message::Ping(_ping)) => {
                                    debug!("🏓 Received ping, sending pong");
                                    // Pong is automatically handled by tungstenite
                                }
                                Ok(Message::Pong(_)) => {
                                    debug!("🏓 Received pong");
                                }
                                Ok(Message::Close(_)) => {
                                    info!("🔚 WebSocket connection closed by server");
                                    *connection_state.write().await = ConnectionState::Disconnected;
                                    break;
                                }
                                Ok(Message::Frame(_)) => {
                                    // Raw frame - usually handled internally by tungstenite
                                    debug!("📦 Received raw frame");
                                }
                                Err(e) => {
                                    error!("❌ WebSocket error: {}", e);
                                    *connection_state.write().await =
                                        ConnectionState::Failed(e.to_string());
                                    break;
                                }
                            }
                        }
                    })
                };

                // Spawn tasks to handle send/receive
                tokio::spawn(sender_task);
                tokio::spawn(receiver_task);

                Ok(())
            }
            Err(e) => {
                error!("❌ Failed to connect WebSocket: {}", e);
                *self.connection_state.write().await = ConnectionState::Failed(e.to_string());
                Err(Box::new(e))
            }
        }
    }

    pub async fn reconnect(&self, url: &str) {
        let mut attempts = self.reconnect_attempts.lock().await;

        if *attempts >= self.max_reconnect_attempts {
            error!("❌ Max reconnection attempts reached, giving up");
            *self.connection_state.write().await =
                ConnectionState::Failed("Max reconnection attempts exceeded".to_string());

            // Notify frontend of reconnection failure
            if let Err(e) = self.app_handle.emit(
                "websocket-reconnect-failed",
                "Max reconnection attempts exceeded",
            ) {
                error!("Failed to emit reconnection failure: {}", e);
            }

            return;
        }

        *attempts += 1;
        *self.connection_state.write().await = ConnectionState::Reconnecting;

        info!(
            "🔄 Reconnection attempt {} of {}",
            *attempts, self.max_reconnect_attempts
        );

        // Notify frontend of reconnection attempt
        if let Err(e) = self.app_handle.emit(
            "websocket-reconnecting",
            serde_json::json!({
                "attempt": *attempts,
                "max_attempts": self.max_reconnect_attempts
            }),
        ) {
            error!("Failed to emit reconnection status: {}", e);
        }

        // Exponential backoff
        let delay = Duration::from_secs(2_u64.pow(*attempts));
        tokio::time::sleep(delay).await;

        drop(attempts); // Release the lock before recursive call

        if let Err(e) = self.connect(url).await {
            error!("❌ Reconnection attempt failed: {}", e);
        }
    }

    pub async fn send_message(
        &self,
        content: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sender_guard = self.sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            let message = serde_json::json!({
                "type": "message",
                "content": content,
                "author": "Admin",
                "channel_id": self.channel_id,
                "agent_id": self.agent_id,
                "timestamp": chrono::Utc::now().timestamp_millis(),
                "source": "eliza_game",
                "client_type": "eliza_game"
            });

            let ws_message = Message::Text(message.to_string());

            if let Err(e) = sender.send(ws_message) {
                error!("Failed to queue message for sending: {}", e);
                return Err(Box::new(e));
            }

            info!("📤 Message queued for sending: {}", content);
            Ok(())
        } else {
            let error_msg = "WebSocket not connected";
            error!("{}", error_msg);
            Err(error_msg.into())
        }
    }

    pub async fn get_connection_state(&self) -> ConnectionState {
        self.connection_state.read().await.clone()
    }

    pub async fn is_connected(&self) -> bool {
        matches!(
            *self.connection_state.read().await,
            ConnectionState::Connected
        )
    }

    pub async fn disconnect(&self) {
        info!("🔌 Disconnecting WebSocket");

        *self.connection_state.write().await = ConnectionState::Disconnected;

        // Clear the sender to close the connection
        *self.sender.lock().await = None;

        info!("✅ WebSocket disconnected");
    }
}

// Make it cloneable for use in multiple contexts
impl Clone for NativeWebSocketClient {
    fn clone(&self) -> Self {
        Self {
            app_handle: self.app_handle.clone(),
            connection_state: self.connection_state.clone(),
            sender: self.sender.clone(),
            agent_id: self.agent_id.clone(),
            channel_id: self.channel_id.clone(),
            reconnect_attempts: self.reconnect_attempts.clone(),
            max_reconnect_attempts: self.max_reconnect_attempts,
        }
    }
}
