/**
 * Media and streaming commands
 * Handles screen capture, audio streaming, and media frame operations
 */
use crate::common::http_client::agent_server_request;
use crate::backend::state::GlobalAppState;
use serde_json::json;
use tauri::{AppHandle, State};
use base64::{Engine as _, engine::general_purpose};
use screenshots::Screen;
use image::ImageFormat;
use std::io::Cursor;

#[tauri::command]
pub async fn stream_media_frame(
    _app: AppHandle,
    _global_state: State<'_, GlobalAppState>,
) -> Result<(), String> {
    tracing::debug!("Taking screenshot for media frame streaming");
    
    // Take screenshot of the primary screen
    let screenshot_result = tokio::task::spawn_blocking(|| {
        take_screenshot()
    }).await.map_err(|e| format!("Screenshot task failed: {}", e))?;

    let (base64_frame, error_msg) = match screenshot_result {
        Ok(frame) => (frame, None),
        Err(e) => {
            tracing::warn!("Screenshot failed: {}", e);
            (String::new(), Some(e))
        }
    };

    // Store the last agent screen state for recovery purposes
    // This allows the UI to restore the last known state if connection is lost

    // Send frame data to the agent server
    let body = if let Some(error) = error_msg {
        json!({
            "frame": base64_frame,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "error": error
        })
    } else {
        json!({
            "frame": base64_frame,
            "timestamp": chrono::Utc::now().to_rfc3339()
        })
    };

    let _ = agent_server_request(
        "POST",
        "/api/vision/frame",
        Some(body),
        Some(5),
    )
    .await;

    Ok(())
}

/// Take a screenshot of the primary screen and return it as base64-encoded PNG
fn take_screenshot() -> Result<String, String> {
    // Get all available screens
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    // Use the primary screen (usually the first one)
    let screen = screens.into_iter().next()
        .ok_or_else(|| "No screens available".to_string())?;

    // Capture the screen
    let screenshot = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;
    
    // Screenshot is already an ImageBuffer, so we can use it directly
    let img_buffer = screenshot;
    
    // Convert to PNG format and encode as base64
    let mut buffer = Cursor::new(Vec::new());
    img_buffer.write_to(&mut buffer, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode screenshot as PNG: {}", e))?;
    
    let base64_data = general_purpose::STANDARD.encode(buffer.into_inner());
    
    tracing::debug!("Screenshot captured successfully, {}x{} pixels, {} bytes base64", 
                   img_buffer.width(), img_buffer.height(), base64_data.len());
    Ok(base64_data)
}

#[tauri::command]
pub async fn stream_media_audio(
    audio_data: Vec<u8>,
    sample_rate: u32,
    channels: u8,
) -> Result<serde_json::Value, String> {
    // Convert audio data to base64 for JSON transport
    let base64_audio = general_purpose::STANDARD.encode(&audio_data);

    let body = json!({
        "audio": base64_audio,
        "sampleRate": sample_rate,
        "channels": channels,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    match agent_server_request("POST", "/api/audio/stream", Some(body), Some(5)).await {
        Ok(response) => Ok(response),
        Err(e) => {
            // Log but return success - audio streaming is non-critical
            tracing::debug!("Failed to stream audio: {}", e);
            Ok(json!({
                "status": "warning",
                "message": "Audio stream not processed"
            }))
        }
    }
}

#[tauri::command]
pub async fn start_agent_screen_capture(
    _global_state: State<'_, GlobalAppState>,
) -> Result<(), String> {
    // Screen capture state is managed by the agent server
    // Local state tracking is not necessary as the server maintains the source of truth

    // Notify the agent server
    let _ = agent_server_request(
        "POST",
        "/api/vision/capture/start",
        Some(json!({ "enabled": true })),
        Some(5),
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn stop_agent_screen_capture(
    _global_state: State<'_, GlobalAppState>,
) -> Result<(), String> {
    // Screen capture state is managed by the agent server
    // Local state tracking is not necessary as the server maintains the source of truth

    // Notify the agent server
    let _ = agent_server_request(
        "POST",
        "/api/vision/capture/stop",
        Some(json!({ "enabled": false })),
        Some(5),
    )
    .await;

    Ok(())
}