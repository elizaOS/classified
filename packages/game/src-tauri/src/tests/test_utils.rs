/// Test utilities for creating Tauri State in tests
use tauri::State;

/// Create a State wrapper for testing
/// 
/// # Safety
/// This uses unsafe transmutation to create a State instance for testing.
/// Only use in tests where the lifetime is controlled.
pub unsafe fn create_test_state<T: Send + Sync + 'static>(value: &T) -> State<'_, T> {
    // We transmute the reference to create a State instance
    // This is safe in tests where we control the lifetime
    std::mem::transmute::<&T, State<'_, T>>(value)
}