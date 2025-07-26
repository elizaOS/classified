use crate::backend::BackendResult;
use axum::extract::ws::WebSocket;
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use std::{collections::HashSet, sync::Arc};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct WebSocketHub {
    clients: Arc<DashMap<Uuid, Client>>,
    rooms: Arc<DashMap<String, HashSet<Uuid>>>,
}

#[allow(dead_code)]
pub struct Client {
    id: Uuid,
    sender: mpsc::UnboundedSender<axum::extract::ws::Message>,
}

impl WebSocketHub {
    #[must_use]
    pub fn new() -> Self {
        Self {
            clients: Arc::new(DashMap::new()),
            rooms: Arc::new(DashMap::new()),
        }
    }

    pub async fn broadcast_to_room(&self, room: &str, message: axum::extract::ws::Message) {
        if let Some(client_ids) = self.rooms.get(room) {
            for client_id in client_ids.iter() {
                if let Some(client) = self.clients.get(client_id) {
                    if let Err(e) = client.sender.send(message.clone()) {
                        warn!("Failed to send message to client {}: {}", client_id, e);
                        // Client might be disconnected, remove it
                        self.remove_client(*client_id);
                    }
                }
            }
        }
    }

    pub async fn send_to_client(&self, client_id: Uuid, message: axum::extract::ws::Message) {
        if let Some(client) = self.clients.get(&client_id) {
            if let Err(e) = client.sender.send(message) {
                warn!("Failed to send message to client {}: {}", client_id, e);
                self.remove_client(client_id);
            }
        }
    }

    pub fn add_client(
        &self,
        client_id: Uuid,
        sender: mpsc::UnboundedSender<axum::extract::ws::Message>,
    ) {
        let client = Client {
            id: client_id,
            sender,
        };
        self.clients.insert(client_id, client);
        info!("Client {} connected", client_id);
    }

    pub fn remove_client(&self, client_id: Uuid) {
        self.clients.remove(&client_id);

        // Remove from all rooms
        for mut room in self.rooms.iter_mut() {
            room.remove(&client_id);
        }

        info!("Client {} disconnected", client_id);
    }

    pub fn join_room(&self, client_id: Uuid, room: &str) {
        self.rooms
            .entry(room.to_string())
            .or_default()
            .insert(client_id);

        debug!("Client {} joined room {}", client_id, room);
    }

    pub fn leave_room(&self, client_id: Uuid, room: &str) {
        if let Some(mut room_clients) = self.rooms.get_mut(room) {
            room_clients.remove(&client_id);
        }

        debug!("Client {} left room {}", client_id, room);
    }

    #[must_use]
    pub fn get_client_count(&self) -> usize {
        self.clients.len()
    }

    #[must_use]
    pub fn get_room_count(&self) -> usize {
        self.rooms.len()
    }
}

impl Default for WebSocketHub {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn handle_client(socket: WebSocket, hub: Arc<WebSocketHub>) {
    let client_id = Uuid::new_v4();
    let (sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Add client to hub
    hub.add_client(client_id, tx);

    // Spawn task to handle outgoing messages
    let sender_task = tokio::spawn(async move {
        let mut sender = sender;
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    let hub_clone = hub.clone();
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(msg) => {
                if let Err(e) = handle_websocket_message(client_id, msg, &hub_clone).await {
                    error!("Error handling WebSocket message: {}", e);
                }
            }
            Err(e) => {
                error!("WebSocket error for client {}: {}", client_id, e);
                break;
            }
        }
    }

    // Cleanup
    sender_task.abort();
    hub.remove_client(client_id);
}

async fn handle_websocket_message(
    client_id: Uuid,
    msg: axum::extract::ws::Message,
    hub: &Arc<WebSocketHub>,
) -> BackendResult<()> {
    use axum::extract::ws::Message;

    match msg {
        Message::Text(text) => {
            debug!("Received text message from {}: {}", client_id, text);

            // Parse message as JSON
            if let Ok(json_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                handle_json_message(client_id, json_msg, hub).await?;
            } else {
                warn!("Invalid JSON message from client {}: {}", client_id, text);
            }
        }
        Message::Binary(data) => {
            debug!(
                "Received binary message from {}: {} bytes",
                client_id,
                data.len()
            );
            // Handle binary messages if needed
        }
        Message::Ping(_data) => {
            debug!("Received ping from {}", client_id);
            // Axum handles pong automatically
        }
        Message::Pong(_data) => {
            debug!("Received pong from {}", client_id);
        }
        Message::Close(_frame) => {
            info!("Client {} requested close", client_id);
        }
    }

    Ok(())
}

async fn handle_json_message(
    client_id: Uuid,
    msg: serde_json::Value,
    hub: &Arc<WebSocketHub>,
) -> BackendResult<()> {
    if let Some(msg_type) = msg.get("type").and_then(|t| t.as_str()) {
        match msg_type {
            "join_room" => {
                if let Some(room) = msg.get("room").and_then(|r| r.as_str()) {
                    hub.join_room(client_id, room);

                    // Send confirmation
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

                    // Send confirmation
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
                    // Broadcast message to room
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
    }

    Ok(())
}

// Re-export Message type for convenience
pub use axum::extract::ws::Message;
