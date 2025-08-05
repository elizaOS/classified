/**
 * Callback management commands
 * Handles retrieval of agent response callbacks
 */
use crate::{AgentResponseCallback, CALLBACK_STORE};

#[tauri::command]
pub async fn get_agent_callbacks() -> Result<Vec<AgentResponseCallback>, String> {
    if let Some(store) = CALLBACK_STORE.get() {
        Ok(store.get_all())
    } else {
        Err("Callback store not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_agent_callback(message_id: String) -> Result<Option<AgentResponseCallback>, String> {
    if let Some(store) = CALLBACK_STORE.get() {
        Ok(store.get(&message_id))
    } else {
        Err("Callback store not initialized".to_string())
    }
}

#[tauri::command]
pub async fn remove_agent_callback(message_id: String) -> Result<Option<AgentResponseCallback>, String> {
    if let Some(store) = CALLBACK_STORE.get() {
        Ok(store.remove(&message_id))
    } else {
        Err("Callback store not initialized".to_string())
    }
}

#[tauri::command]
pub async fn clear_agent_callbacks() -> Result<(), String> {
    if let Some(store) = CALLBACK_STORE.get() {
        store.0.clear();
        Ok(())
    } else {
        Err("Callback store not initialized".to_string())
    }
}