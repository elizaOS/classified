/**
 * Application lifecycle Tauri commands
 * Handles application shutdown, health checks, and system management
 */
use crate::backend::state::GlobalAppState;
use crate::container::manager::ContainerManager;
use crate::CrashFile;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, Emitter};
use tracing::{error, info, warn};

// Health check is defined in testing.rs module

/// Gracefully shuts down the application by stopping all containers first
#[tauri::command]
pub async fn shutdown_application(
    app: AppHandle,
    container_manager: State<'_, Arc<ContainerManager>>,
    crash_file: State<'_, CrashFile>,
    global_state: State<'_, GlobalAppState>,
) -> Result<(), String> {
    info!("🔄 Starting application shutdown sequence...");

    // Hide the main window during shutdown
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.hide();
    }

    // Create shutdown backup
    app.emit("shutdown-progress", "Creating shutdown backup...")
        .unwrap();
    info!("💾 Creating shutdown backup...");

    let backup_manager = global_state.backup_manager.read().await;
    match backup_manager.create_shutdown_backup().await {
        Ok(()) => {
            info!("✅ Shutdown backup created successfully");
            app.emit("shutdown-progress", "Backup created successfully")
                .unwrap();
        }
        Err(e) => {
            error!("❌ Failed to create shutdown backup: {}", e);
            // Continue with shutdown even if backup fails
        }
    }

    // Emit shutdown progress event
    app.emit("shutdown-progress", "Stopping containers...")
        .unwrap();

    // Stop all containers
    info!("📦 Stopping all containers...");
    match container_manager.stop_containers().await {
        Ok(()) => {
            info!("✅ All containers stopped successfully");
            app.emit("shutdown-progress", "Containers stopped successfully")
                .unwrap();
        }
        Err(e) => {
            error!("❌ Failed to stop containers: {}", e);
            app.emit(
                "shutdown-progress",
                &format!("Error stopping containers: {}", e),
            )
            .unwrap();
            // Continue with shutdown even if container stop fails
        }
    }

    // Remove crash recovery file on clean shutdown
    if let Err(e) = std::fs::remove_file(&crash_file.0) {
        warn!("Failed to remove crash recovery file: {}", e);
    } else {
        info!("✅ Removed crash recovery file");
    }

    // Give a moment for the UI to update
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Exit the application
    info!("👋 Exiting application...");
    app.exit(0);

    Ok(())
}

// Reset agent is defined in agent.rs module