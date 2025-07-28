use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message as TungsteniteMessage};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

// Server-side WebSocket hub for managing connections
#[derive(Clone)]
pub struct WebSocketHub {
    clients: Arc<DashMap<Uuid, Client>>,
    rooms: Arc<DashMap<String, HashSet<Uuid>>>,
}

#[derive(Clone)]
pub struct Client {
    sender: mpsc::UnboundedSender<Message>,
}

impl WebSocketHub {
    #[must_use]
    pub fn new() -> Self {
        Self {
            clients: Arc::new(DashMap::new()),
            rooms: Arc::new(DashMap::new()),
        }
    }

    pub async fn broadcast_to_room(&self, room: &str, message: Message) {
        if let Some(room_clients) = self.rooms.get(room) {
            for client_id in room_clients.iter() {
                if let Some(client) = self.clients.get(client_id) {
                    if let Err(e) = client.sender.send(message.clone()) {
                        warn!("Failed to send message to client {}: {}", client_id, e);
                    }
                }
            }
        }
    }

    pub async fn send_to_client(&self, client_id: Uuid, message: Message) {
        if let Some(client) = self.clients.get(&client_id) {
            if let Err(e) = client.sender.send(message) {
                warn!("Failed to send message to client {}: {}", client_id, e);
            }
        }
    }

    pub fn add_client(
        &self,
        client_id: Uuid,
        sender: mpsc::UnboundedSender<Message>,
    ) {
        self.clients.insert(
            client_id,
            Client {
                sender,
            },
        );
        info!("Client {} connected", client_id);
    }

    pub fn remove_client(&self, client_id: Uuid) {
        self.clients.remove(&client_id);
        // Remove from all rooms
        for mut room in self.rooms.iter_mut() {
            room.value_mut().remove(&client_id);
        }
        info!("Client {} disconnected", client_id);
    }

    pub fn join_room(&self, client_id: Uuid, room: &str) {
        self.rooms
            .entry(room.to_string())
            .or_insert_with(HashSet::new)
            .insert(client_id);
        info!("Client {} joined room {}", client_id, room);
    }

    pub fn leave_room(&self, client_id: Uuid, room: &str) {
        if let Some(mut room_clients) = self.rooms.get_mut(room) {
            room_clients.remove(&client_id);
        }
        info!("Client {} left room {}", client_id, room);
    }

    pub fn get_client_count(&self) -> usize {
        self.clients.len()
    }

    pub fn get_room_count(&self) -> usize {
        self.rooms.len()
    }
}

impl Default for WebSocketHub {
    fn default() -> Self {
        Self::new()
    }
}

// Server-side WebSocket handler for HTTP server
pub async fn handle_client(socket: WebSocket, hub: Arc<WebSocketHub>) {
    let client_id = Uuid::new_v4();
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Add client to hub
    hub.add_client(client_id, sender.clone());

    // Send welcome message
    let welcome_msg = serde_json::json!({
        "type": "welcome",
        "client_id": client_id,
        "message": "Connected to ElizaOS WebSocket server"
    });

    if let Err(e) = ws_sender
        .send(Message::Text(welcome_msg.to_string()))
        .await
    {
        error!("Failed to send welcome message to client {}: {}", client_id, e);
        return;
    }

    // Spawn task to send messages to client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = receiver.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Spawn task to receive messages from client
    let hub_clone = hub.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Err(e) = handle_websocket_message(client_id, msg, &hub_clone).await {
                error!("Error handling message from client {}: {}", client_id, e);
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => {
            recv_task.abort();
        }
        _ = &mut recv_task => {
            send_task.abort();
        }
    }

    // Clean up
    hub.remove_client(client_id);
}

async fn handle_websocket_message(
    client_id: Uuid,
    msg: Message,
    hub: &Arc<WebSocketHub>,
) -> Result<(), Box<dyn std::error::Error>> {
    match msg {
        Message::Text(text) => {
            handle_json_message(client_id, serde_json::from_str(&text)?, hub).await
        }
        Message::Binary(_) => {
            warn!("Binary messages not supported");
            Ok(())
        }
        Message::Ping(_) | Message::Pong(_) => Ok(()),
        Message::Close(_) => {
            info!("Client {} sent close message", client_id);
            Ok(())
        }
    }
}

async fn handle_json_message(
    client_id: Uuid,
    msg: serde_json::Value,
    hub: &Arc<WebSocketHub>,
) -> Result<(), Box<dyn std::error::Error>> {
    let msg_type = msg
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");

    match msg_type {
        "ping" => {
            let pong = serde_json::json!({
                "type": "pong",
                "timestamp": chrono::Utc::now().timestamp()
            });
            hub.send_to_client(client_id, Message::Text(pong.to_string()))
                .await;
        }
        "join_room" => {
            if let Some(room) = msg.get("room").and_then(|r| r.as_str()) {
                hub.join_room(client_id, room);

                let response = serde_json::json!({
                    "type": "room_joined",
                    "room": room,
                    "client_id": client_id
                });

                hub.send_to_client(client_id, Message::Text(response.to_string()))
                    .await;
            }
        }
        "leave_room" => {
            if let Some(room) = msg.get("room").and_then(|r| r.as_str()) {
                hub.leave_room(client_id, room);

                let response = serde_json::json!({
                    "type": "room_left",
                    "room": room,
                    "client_id": client_id
                });

                hub.send_to_client(client_id, Message::Text(response.to_string()))
                    .await;
            }
        }
        "message" => {
            if let (Some(room), Some(content)) =
                (msg.get("room").and_then(|r| r.as_str()), msg.get("content"))
            {
                let broadcast_msg = serde_json::json!({
                    "type": "message",
                    "room": room,
                    "client_id": client_id,
                    "content": content,
                    "timestamp": chrono::Utc::now().timestamp()
                });

                hub.broadcast_to_room(room, Message::Text(broadcast_msg.to_string()))
                    .await;
            }
        }
        _ => {
            warn!(
                "Unknown message type from client {}: {}",
                client_id, msg_type
            );
        }
    }

    Ok(())
}

// Handler for WebSocket upgrade requests
pub async fn app_websocket_handler(
    ws: WebSocketUpgrade,
    hub: Arc<WebSocketHub>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_client(socket, hub))
}

// Client-side WebSocket for connecting to agent server
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
    #[allow(dead_code)]
    Failed(String),
}

pub struct WebSocketClient {
    app_handle: AppHandle,
    connection_state: Arc<RwLock<ConnectionState>>,
    sender: Arc<Mutex<Option<mpsc::UnboundedSender<TungsteniteMessage>>>>,
    agent_id: String,
    channel_id: String,
    reconnect_attempts: Arc<Mutex<u32>>,
    max_reconnect_attempts: u32,
}

impl WebSocketClient {
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

        // Parse WebSocket URL
        let ws_url = if url.starts_with("http://localhost:7777") {
            "ws://localhost:7777/ws".to_string()
        } else if url.starts_with("http://") {
            url.replace("http://", "ws://")
        } else if url.starts_with("https://") {
            url.replace("https://", "wss://")
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
                let (tx, mut rx) = mpsc::unbounded_channel::<TungsteniteMessage>();

                // Store sender for outgoing messages
                *self.sender.lock().await = Some(tx.clone());

                // Wait a bit before sending initial message to ensure handshake completion
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                // Send initial connection message
                let connect_msg = serde_json::json!({
                    "type": "connect",
                    "agent_id": self.agent_id,
                    "channel_id": self.channel_id,
                    "client_type": "eliza_game",
                    "timestamp": chrono::Utc::now().timestamp_millis()
                });

                info!("Sending initial connection message...");
                if let Err(e) = ws_sender.send(TungsteniteMessage::Text(connect_msg.to_string())).await {
                    error!("Failed to send connect message: {}", e);
                    *self.connection_state.write().await = ConnectionState::Failed(format!("Failed to send initial message: {}", e));
                    return Err(Box::new(e));
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

                // Handle incoming messages in current task to avoid lifetime issues
                let app_handle = self.app_handle.clone();
                let connection_state = self.connection_state.clone();
                let channel_id = self.channel_id.clone();
                
                let receiver_task = tokio::spawn(async move {
                    while let Some(msg) = ws_receiver.next().await {
                            match msg {
                                Ok(TungsteniteMessage::Text(text)) => {
                                    debug!("📨 Received WebSocket message: {}", text);

                                    if let Ok(parsed_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                                        let msg_type = parsed_msg
                                            .get("type")
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("unknown");

                                        match msg_type {
                                            "connection_ack" => {
                                                info!("✅ Connection acknowledged by agent server");
                                                if let Err(e) = app_handle.emit("websocket-connected", &parsed_msg) {
                                                    error!("Failed to emit connection status: {}", e);
                                                }
                                            }
                                            "message_ack" => {
                                                info!("✅ Message acknowledged by server");
                                                if let Err(e) = app_handle.emit("message-acknowledged", &parsed_msg) {
                                                    error!("Failed to emit message acknowledgment: {}", e);
                                                }
                                            }
                                            "agent_message" | "agent_response" => {
                                                // Extract the actual agent response
                                                let agent_msg = AgentMessage {
                                                    id: parsed_msg.get("id")
                                                        .and_then(|i| i.as_str())
                                                        .unwrap_or("unknown")
                                                        .to_string(),
                                                    content: parsed_msg.get("content")
                                                        .and_then(|c| c.as_str())
                                                        .unwrap_or("")
                                                        .to_string(),
                                                    author: parsed_msg.get("author")
                                                        .and_then(|a| a.as_str())
                                                        .unwrap_or("ELIZA")
                                                        .to_string(),
                                                    timestamp: parsed_msg.get("timestamp")
                                                        .and_then(|t| t.as_u64())
                                                        .unwrap_or(0),
                                                    channel_id: Some(channel_id.clone()),
                                                    message_type: "agent_response".to_string(),
                                                };

                                                info!("🤖 Agent response: {}", agent_msg.content);

                                                // Emit to frontend
                                                if let Err(e) = app_handle.emit("agent-message", &agent_msg) {
                                                    error!("Failed to emit agent message: {}", e);
                                                }
                                            }
                                            "error" => {
                                                error!("❌ Server error: {}", parsed_msg.get("message")
                                                    .and_then(|m| m.as_str())
                                                    .unwrap_or("Unknown error"));
                                            }
                                            _ => {
                                                debug!("📄 Message type '{}': {}", msg_type, text);
                                            }
                                        }
                                    }
                                }
                                Ok(TungsteniteMessage::Close(_)) => {
                                    info!("🔚 WebSocket connection closed by server");
                                    *connection_state.write().await = ConnectionState::Disconnected;
                                    break;
                                }
                                Err(e) => {
                                    error!("❌ WebSocket error: {}", e);
                                    *connection_state.write().await = ConnectionState::Failed(e.to_string());
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });

                // Spawn tasks
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
            error!("❌ Max reconnection attempts reached");
            *self.connection_state.write().await =
                ConnectionState::Failed("Max reconnection attempts exceeded".to_string());
            return;
        }

        *attempts += 1;
        *self.connection_state.write().await = ConnectionState::Reconnecting;

        info!("🔄 Reconnection attempt {} of {}", *attempts, self.max_reconnect_attempts);

        // Exponential backoff
        let delay = Duration::from_secs(2_u64.pow(*attempts));
        tokio::time::sleep(delay).await;

        drop(attempts);

        if let Err(e) = self.connect(url).await {
            error!("❌ Reconnection failed: {}", e);
            // Note: Cannot auto-retry here due to lifetime constraints
            // Frontend will need to trigger reconnection if needed
        }
    }

    pub async fn send_message(
        &self,
        content: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sender_guard = self.sender.lock().await;

        if let Some(sender) = sender_guard.as_ref() {
            // Format message according to agent server expectations
            let message = serde_json::json!({
                "type": "message",
                "content": content,
                "author": "Admin",
                "channel_id": self.channel_id,
                "agent_id": self.agent_id,
                "timestamp": chrono::Utc::now().timestamp_millis()
            });

            let ws_message = TungsteniteMessage::Text(message.to_string());

            if let Err(e) = sender.send(ws_message) {
                error!("Failed to queue message: {}", e);
                return Err(Box::new(e));
            }

            info!("📤 Message sent: {}", content);
            Ok(())
        } else {
            Err("WebSocket not connected".into())
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
        *self.sender.lock().await = None;
        info!("✅ WebSocket disconnected");
    }
}

impl Clone for WebSocketClient {
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
