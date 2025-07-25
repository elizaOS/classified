use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message, WebSocketStream};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
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

pub struct WebSocketManager {
    app_handle: AppHandle,
    ws_stream: Option<WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>,
    is_connected: bool,
    agent_id: String,
    channel_id: Option<String>,
}

impl WebSocketManager {
    pub fn new(app_handle: AppHandle, agent_id: String) -> Self {
        Self {
            app_handle,
            ws_stream: None,
            is_connected: false,
            agent_id,
            channel_id: None,
        }
    }

    pub async fn connect(&mut self, url: &str) -> Result<(), Box<dyn std::error::Error>> {
        info!("Connecting to WebSocket at {}", url);

        match connect_async(url).await {
            Ok((ws_stream, _)) => {
                self.ws_stream = Some(ws_stream);
                self.is_connected = true;
                info!("WebSocket connected successfully");

                // Emit connection status to frontend
                self.app_handle
                    .emit("websocket-connected", ())
                    .map_err(|e| format!("Failed to emit connected event: {}", e))?;

                Ok(())
            }
            Err(e) => {
                error!("Failed to connect to WebSocket: {}", e);
                self.is_connected = false;
                Err(Box::new(e))
            }
        }
    }

    pub async fn join_channel(&mut self, channel_id: String) -> Result<(), Box<dyn std::error::Error>> {
        if !self.is_connected || self.ws_stream.is_none() {
            return Err("WebSocket not connected".into());
        }

        self.channel_id = Some(channel_id.clone());

        // Send room joining message
        let join_msg = serde_json::json!({
            "type": 1, // SOCKET_MESSAGE_TYPE.ROOM_JOINING
            "payload": {
                "channelId": channel_id,
                "roomId": channel_id, // Keep for backward compatibility
                "entityId": self.agent_id,
            }
        });

        if let Some(ws) = &mut self.ws_stream {
            ws.send(Message::Text(join_msg.to_string())).await?;
            info!("Joined channel: {}", channel_id);
        }

        Ok(())
    }

    pub async fn listen_for_messages(
        manager: Arc<Mutex<Self>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        loop {
            let mut mgr = manager.lock().await;

            if !mgr.is_connected || mgr.ws_stream.is_none() {
                warn!("WebSocket not connected, waiting...");
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }

            // Take the stream out temporarily
            let mut ws_stream = mgr.ws_stream.take().unwrap();
            let app_handle = mgr.app_handle.clone();
            let channel_id = mgr.channel_id.clone();

            // Release the lock while we process messages
            drop(mgr);

            // Process messages
            match ws_stream.next().await {
                Some(Ok(msg)) => match msg {
                    Message::Text(text) => {
                        info!("Received WebSocket message: {}", text);

                        // Try to parse as messageBroadcast
                        if let Ok(broadcast) = serde_json::from_str::<MessageBroadcast>(&text) {
                            if broadcast.msg_type == "messageBroadcast" {
                                // Only process messages for our channel
                                if Some(&broadcast.payload.channel_id) == channel_id.as_ref() {
                                    // Convert to our message format
                                    let ws_msg = WsMessage {
                                        id: broadcast.payload.message_id,
                                        content: broadcast.payload.text,
                                        author_id: broadcast.payload.sender_id.clone(),
                                        author_name: Some(broadcast.payload.sender_name),
                                        timestamp: chrono::DateTime::from_timestamp(
                                            broadcast.payload.created_at / 1000,
                                            0,
                                        )
                                        .unwrap_or_default()
                                        .to_rfc3339(),
                                        msg_type: if broadcast.payload.sender_id.contains("agent") {
                                            "agent".to_string()
                                        } else {
                                            "user".to_string()
                                        },
                                        metadata: broadcast.payload.metadata,
                                    };

                                    // Emit to frontend
                                    if let Err(e) = app_handle.emit("agent-message", &ws_msg) {
                                        error!("Failed to emit message to frontend: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Message::Close(_) => {
                        info!("WebSocket closed by server");
                        let mut mgr = manager.lock().await;
                        mgr.is_connected = false;
                        mgr.ws_stream = None;

                        if let Err(e) = mgr.app_handle.emit("websocket-disconnected", ()) {
                            error!("Failed to emit disconnected event: {}", e);
                        }
                        return Ok(());
                    }
                    _ => {}
                },
                Some(Err(e)) => {
                    error!("WebSocket error: {}", e);
                    let mut mgr = manager.lock().await;
                    mgr.is_connected = false;
                    mgr.ws_stream = None;
                    return Err(Box::new(e));
                }
                None => {
                    info!("WebSocket stream ended");
                    let mut mgr = manager.lock().await;
                    mgr.is_connected = false;
                    mgr.ws_stream = None;
                    return Ok(());
                }
            }

            // Put the stream back
            let mut mgr = manager.lock().await;
            mgr.ws_stream = Some(ws_stream);
        }
    }

    pub fn is_connected(&self) -> bool {
        self.is_connected
    }

    pub async fn disconnect(&mut self) {
        if let Some(mut ws) = self.ws_stream.take() {
            let _ = ws.close(None).await;
        }
        self.is_connected = false;
        self.channel_id = None;
    }
}