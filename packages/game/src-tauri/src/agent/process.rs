use crate::backend::BackendResult;
use std::process::Child;
use tracing::{info, error};
use uuid::Uuid;

/// Agent process wrapper for managing ElizaOS agent instances
pub struct AgentProcessManager {
    processes: std::collections::HashMap<Uuid, Child>,
}

impl AgentProcessManager {
    pub fn new() -> Self {
        Self {
            processes: std::collections::HashMap::new(),
        }
    }


    /// Cleanup all agent processes
    pub fn cleanup_all(&mut self) -> BackendResult<()> {
        info!("Cleaning up all agent processes");
        
        for (id, mut process) in self.processes.drain() {
            if let Err(e) = process.kill() {
                error!("Failed to kill agent {}: {}", id, e);
            }
        }

        Ok(())
    }
}

impl Default for AgentProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for AgentProcessManager {
    fn drop(&mut self) {
        let _ = self.cleanup_all();
    }
}