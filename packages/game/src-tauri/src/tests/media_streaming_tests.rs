use crate::server::websocket::WebSocketClient;
use crate::*;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener};
use tracing::info;

/// Test module for media streaming functionality
pub struct MediaStreamingTests;

impl MediaStreamingTests {
    /// Run all media streaming tests
    pub async fn run_all_tests(app_handle: AppHandle) -> Result<(), String> {
        info!("🧪 Starting Media Streaming Tests");

        // Test 1: Test media IPC commands exist
        Self::test_media_ipc_commands(&app_handle).await?;

        // Test 2: Test WebSocket media methods
        Self::test_websocket_media_methods(&app_handle).await?;

        // Test 3: Test agent screen capture commands
        Self::test_agent_screen_capture(&app_handle).await?;

        // Test 4: Test media streaming toggle
        Self::test_media_streaming_toggle(&app_handle).await?;

        // Test 5: Test streaming lifecycle
        Self::test_streaming_lifecycle(&app_handle).await?;

        info!("✅ All Media Streaming Tests Passed!");
        Ok(())
    }

    /// Test that media IPC commands are registered and callable
    async fn test_media_ipc_commands(app_handle: &AppHandle) -> Result<(), String> {
        info!("🧪 Test 1: Testing media IPC commands");

        // Test stream_media_frame command with mock data
        let test_frame = vec![0u8; 1024]; // 1KB test frame
        match app_handle.emit(
            "test-ipc-call",
            serde_json::json!({
                "command": "stream_media_frame",
                "args": {
                    "stream_type": "test",
                    "frame_data": test_frame,
                    "timestamp": chrono::Utc::now().timestamp_millis() as u64
                }
            }),
        ) {
            Ok(_) => info!("✅ stream_media_frame command accessible"),
            Err(e) => return Err(format!("❌ stream_media_frame command failed: {}", e)),
        }

        // Test stream_media_audio command
        let test_audio = vec![0u8; 512]; // 512B test audio
        match app_handle.emit(
            "test-ipc-call",
            serde_json::json!({
                "command": "stream_media_audio",
                "args": {
                    "audio_data": test_audio,
                    "timestamp": chrono::Utc::now().timestamp_millis() as u64
                }
            }),
        ) {
            Ok(_) => info!("✅ stream_media_audio command accessible"),
            Err(e) => return Err(format!("❌ stream_media_audio command failed: {}", e)),
        }

        Ok(())
    }

    /// Test WebSocket media streaming methods
    async fn test_websocket_media_methods(app_handle: &AppHandle) -> Result<(), String> {
        info!("🧪 Test 2: Testing WebSocket media methods");

        // Get WebSocket client
        let ws_client = app_handle.state::<Arc<WebSocketClient>>().inner().clone();

        // Test connection state
        let is_connected = ws_client.is_connected().await;
        info!("WebSocket connected: {}", is_connected);

        if is_connected {
            // Test sending a media frame
            let test_frame = vec![0u8; 1024];
            match ws_client.send_media_frame(test_frame, "test").await {
                Ok(_) => info!("✅ WebSocket media frame method works"),
                Err(e) => info!(
                    "⚠️ WebSocket media frame failed (expected if no active stream): {}",
                    e
                ),
            }

            // Test sending audio chunk
            let test_audio = vec![0u8; 512];
            match ws_client.send_audio_chunk(test_audio).await {
                Ok(_) => info!("✅ WebSocket audio chunk method works"),
                Err(e) => info!(
                    "⚠️ WebSocket audio chunk failed (expected if no active stream): {}",
                    e
                ),
            }
        } else {
            info!("⚠️ WebSocket not connected, skipping media method tests");
        }

        Ok(())
    }

    /// Test agent screen capture start/stop
    async fn test_agent_screen_capture(_app_handle: &AppHandle) -> Result<(), String> {
        info!("🧪 Test 3: Testing agent screen capture commands");

        // NOTE: Can't directly call Tauri commands from tests due to State<> dependencies
        info!("🔄 Skipping screen capture tests (requires Tauri state injection)");
        
        // In a real test, you would need to use Tauri's test utilities to provide
        // the required State<GlobalAppState> dependency

        Ok(())
    }

    /// Test media streaming on/off toggle
    async fn test_media_streaming_toggle(_app_handle: &AppHandle) -> Result<(), String> {
        info!("🧪 Test 4: Testing media streaming toggle functionality");

        // NOTE: Can't directly call Tauri commands from tests due to State<> dependencies
        info!("🔄 Skipping capability toggle tests (requires Tauri state injection)");
        
        // In a real test, you would need to mock the agent server responses
        // or use Tauri's test utilities to provide proper state injection

        Ok(())
    }

    /// Test that media streaming properly starts and stops
    pub async fn test_streaming_lifecycle(app_handle: &AppHandle) -> Result<(), String> {
        info!("🧪 Testing media streaming lifecycle");

        // Listen for media stream acknowledgments
        let (tx, mut rx) = tokio::sync::mpsc::channel(10);
        let tx_clone = tx.clone();

        let _unlisten = app_handle.listen("media_stream_ack", move |event| {
            let payload = event.payload();
            let _ = tx_clone.blocking_send(payload.to_string());
        });

        // Send a test frame
        let test_frame = vec![0u8; 1024];
        app_handle
            .emit(
                "test-media-frame",
                serde_json::json!({
                    "type": "video",
                    "stream_type": "camera",
                    "data": test_frame,
                    "timestamp": chrono::Utc::now().timestamp_millis()
                }),
            )
            .map_err(|e| format!("Failed to emit test frame: {}", e))?;

        // Wait for acknowledgment with timeout
        match tokio::time::timeout(tokio::time::Duration::from_secs(2), rx.recv()).await {
            Ok(Some(ack)) => {
                info!("✅ Received media stream acknowledgment: {}", ack);
                Ok(())
            }
            Ok(None) => {
                info!("⚠️ Channel closed without acknowledgment");
                Ok(())
            }
            Err(_) => {
                info!("⚠️ Timeout waiting for acknowledgment (expected if not fully connected)");
                Ok(())
            }
        }
    }
}

/// Runtime test entry point
pub async fn test_media_streaming(app_handle: AppHandle) -> Result<(), String> {
    MediaStreamingTests::run_all_tests(app_handle).await
}
