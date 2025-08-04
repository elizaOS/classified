use crate::backup::BackupManager;
use crate::container::ContainerManager;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Global application state shared across all Tauri commands
pub struct GlobalAppState {
    #[allow(dead_code)] // Used through Tauri State system in server/http.rs
    pub container_manager: Arc<ContainerManager>,
    pub backup_manager: Arc<RwLock<BackupManager>>,
}

impl GlobalAppState {
    pub fn new(
        container_manager: Arc<ContainerManager>,
        backup_manager: Arc<RwLock<BackupManager>>,
    ) -> Self {
        Self {
            container_manager,
            backup_manager,
        }
    }
}
