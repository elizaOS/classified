use rust_socketio::{ClientBuilder, Event, Payload, client::Client};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocketIOMessage {
    pub id: String,
    pub content: String,
    #[serde(rename = "authorId")]
    pub author_id: String,
    #[serde(rename = "authorName")]
    pub author_name: Option<String>,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageBroadcast {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: BroadcastPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastPayload {
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "messageId")]
    pub message_id: String,
    #[serde(rename = "senderId")]
    pub sender_id: String,
    #[serde(rename = "senderName")]
    pub sender_name: String,
    pub text: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub metadata: Option<serde_json::Value>,
}

pub struct SocketIOManager {
    app_handle: AppHandle,
    client: Option<Client>,
    is_connected: bool,
    agent_id: String,
    channel_id: Option<String>,
}

impl SocketIOManager {
    pub fn new(app_handle: AppHandle, agent_id: String) -> Self {
        Self {
            app_handle,
            client: None,
            is_connected: false,
            agent_id,
            channel_id: None,
        }
    }

    pub async fn connect(&mut self, url: &str) -> Result<(), String> {
        info!("🔌 Connecting to Socket.IO server at {}", url);

        // Create Socket.IO client
        let client = ClientBuilder::new(url)
            .on(Event::Connect, {
                let app_handle = self.app_handle.clone();
                move |_payload, _client| {
                    info!("✅ Socket.IO connected successfully");
                    if let Err(e) = app_handle.emit("socketio-connected", ()) {
                        error!("Failed to emit connected event: {}", e);
                    }
                }
            })
            .on("disconnect", {
                let app_handle = self.app_handle.clone();
                move |_payload, _client| {
                    warn!("🔌 Socket.IO disconnected");
                    if let Err(e) = app_handle.emit("socketio-disconnected", ()) {
                        error!("Failed to emit disconnected event: {}", e);
                    }
                }
            })
            .on("message", {
                let app_handle = self.app_handle.clone();
                move |payload, _client| {
                    if let Payload::Text(text) = payload {
                        info!("📨 Received message: {}", text[0]);
                        
                        // Try to parse as agent message
                        if let Ok(message) = serde_json::from_value::<SocketIOMessage>(text[0].clone()) {
                            if let Err(e) = app_handle.emit("agent-message-received", &message) {
                                error!("Failed to emit message event: {}", e);
                            }
                        } else {
                            info!("📨 Raw message received: {}", text[0]);
                            if let Err(e) = app_handle.emit("raw-message-received", &text[0]) {
                                error!("Failed to emit raw message event: {}", e);
                            }
                        }
                    }
                }
            })
            .on("agent-response", {
                let app_handle = self.app_handle.clone();
                move |payload, _client| {
                    if let Payload::Text(text) = payload {
                        info!("🤖 Agent response received: {}", text[0]);
                        if let Err(e) = app_handle.emit("agent-response", &text[0]) {
                            error!("Failed to emit agent response event: {}", e);
                        }
                    }
                }
            })
            .on("broadcast", {
                let app_handle = self.app_handle.clone();
                move |payload, _client| {
                    if let Payload::Text(text) = payload {
                        info!("📡 Broadcast received: {}", text[0]);
                        
                        // Try to parse as message broadcast
                        if let Ok(broadcast) = serde_json::from_value::<MessageBroadcast>(text[0].clone()) {
                            if let Err(e) = app_handle.emit("message-broadcast", &broadcast) {
                                error!("Failed to emit broadcast event: {}", e);
                            }
                        }
                    }
                }
            })
            .on(Event::Error, move |payload, _client| {
                if let Payload::Text(text) = payload {
                    error!("❌ Socket.IO error: {}", text[0]);
                } else {
                    error!("❌ Socket.IO error occurred");
                }
            })
            .connect()
            .map_err(|e| format!("Socket.IO connection failed: {}", e))?;

        self.client = Some(client);
        self.is_connected = true;

        info!("✅ Socket.IO client connected and event handlers registered");
        Ok(())
    }

    pub async fn join_room(&mut self, room_id: String) -> Result<(), Box<dyn std::error::Error>> {
        if !self.is_connected || self.client.is_none() {
            return Err("Socket.IO not connected".into());
        }

        self.channel_id = Some(room_id.clone());

        // Send room joining message
        let join_msg = serde_json::json!({
            "type": "join-room",
            "payload": {
                "roomId": room_id,
                "agentId": self.agent_id,
            }
        });

        if let Some(client) = &self.client {
            client.emit("join-room", join_msg)?;
            info!("📍 Joined room: {}", room_id);
        }

        Ok(())
    }

    pub async fn send_message(&self, message: &str, room_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if !self.is_connected || self.client.is_none() {
            return Err("Socket.IO not connected".into());
        }

        let msg = serde_json::json!({
            "type": "message",
            "payload": {
                "text": message,
                "roomId": room_id,
                "authorId": "game-ui-user",
                "authorName": "Admin",
                "timestamp": chrono::Utc::now().timestamp_millis(),
                "metadata": {
                    "source": "eliza_game"
                }
            }
        });

        if let Some(client) = &self.client {
            client.emit("message", msg)?;
            info!("📤 Message sent to room {}: {}", room_id, message);
        }

        Ok(())
    }

    pub async fn disconnect(&mut self) {
        if let Some(client) = &self.client {
            if let Err(e) = client.disconnect() {
                error!("Error disconnecting Socket.IO client: {}", e);
            } else {
                info!("🔌 Socket.IO client disconnected");
            }
        }
        
        self.client = None;
        self.is_connected = false;
        
        if let Err(e) = self.app_handle.emit("socketio-disconnected", ()) {
            error!("Failed to emit disconnected event: {}", e);
        }
    }

    pub fn is_connected(&self) -> bool {
        self.is_connected
    }

    pub fn get_channel_id(&self) -> Option<String> {
        self.channel_id.clone()
    }

    // Static method for listening to messages - used by the main spawn
    pub async fn listen_for_messages(
        manager: Arc<Mutex<SocketIOManager>>
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Socket.IO handles message listening through event callbacks
        // This method is kept for compatibility but doesn't need to do anything
        // The real message handling happens in the event callbacks registered during connect()
        
        info!("👂 Socket.IO message listener started (event-driven)");
        
        // Keep the listener alive - in real usage this would be managed by the Socket.IO client lifecycle
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            
            let manager_guard = manager.lock().await;
            if !manager_guard.is_connected() {
                info!("🔌 Socket.IO disconnected, stopping listener");
                break;
            }
            drop(manager_guard);
        }

        Ok(())
    }
}