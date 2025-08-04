use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Manages exclusive locks for operations to prevent double-clicks and concurrent execution
pub struct OperationLock {
    #[allow(dead_code)]
    active: Arc<DashMap<String, OperationInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationInfo {
    pub id: String,
    pub operation: String,
    pub description: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

impl OperationLock {
    pub fn new() -> Self {
        Self {
            active: Arc::new(DashMap::new()),
        }
    }

    /// Check if an operation is currently locked
    #[allow(dead_code)]
    pub fn is_locked(&self, operation: &str) -> bool {
        self.active.contains_key(operation)
    }

    /// Get all active operations
    #[allow(dead_code)]
    pub fn get_active_operations(&self) -> Vec<OperationInfo> {
        self.active
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Force unlock an operation (use with caution)
    #[allow(dead_code)]
    pub fn force_unlock(&self, operation: &str) {
        self.active.remove(operation);
    }

    /// Try to acquire a lock for an operation
    /// Returns Ok(guard) if successful, Err if operation is already locked
    pub fn try_lock(&self, operation: &str, description: &str) -> Result<OperationGuard, String> {
        let operation_info = OperationInfo {
            id: uuid::Uuid::new_v4().to_string(),
            operation: operation.to_string(),
            description: description.to_string(),
            started_at: chrono::Utc::now(),
        };

        // Use entry API for atomic check-and-insert
        match self.active.entry(operation.to_string()) {
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                entry.insert(operation_info.clone());
                tracing::debug!("Acquired lock for operation: {}", operation);
                Ok(OperationGuard {
                    lock: self.active.clone(),
                    operation: operation.to_string(),
                    id: operation_info.id,
                })
            }
            dashmap::mapref::entry::Entry::Occupied(_) => {
                Err(format!("Operation '{}' is already in progress", operation))
            }
        }
    }
}

/// RAII guard that automatically releases the lock when dropped
pub struct OperationGuard {
    lock: Arc<DashMap<String, OperationInfo>>,
    operation: String,
    #[allow(dead_code)]
    id: String,
}

impl Drop for OperationGuard {
    fn drop(&mut self) {
        self.lock.remove(&self.operation);
        tracing::debug!("Released lock for operation: {}", self.operation);
    }
}

impl Default for OperationLock {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper macro to run an operation with a lock
#[macro_export]
macro_rules! with_operation_lock {
    ($lock:expr, $op:expr, $desc:expr, $body:expr) => {{
        let _guard = $lock.try_lock($op, $desc)?;
        $body
    }};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operation_lock() {
        let lock = OperationLock::new();

        // First lock should succeed
        let guard1 = lock.try_lock("test_op", "Test operation");
        assert!(guard1.is_ok());

        // Second lock should fail
        let guard2 = lock.try_lock("test_op", "Test operation");
        assert!(guard2.is_err());

        // Drop first guard
        drop(guard1);

        // Now lock should succeed again
        let guard3 = lock.try_lock("test_op", "Test operation");
        assert!(guard3.is_ok());
    }

    #[test]
    fn test_different_operations() {
        let lock = OperationLock::new();

        // Lock different operations should both succeed
        let guard1 = lock.try_lock("op1", "Operation 1");
        let guard2 = lock.try_lock("op2", "Operation 2");

        assert!(guard1.is_ok());
        assert!(guard2.is_ok());
    }
}
