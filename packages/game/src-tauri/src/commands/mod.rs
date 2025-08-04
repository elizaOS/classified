/**
 * Modularized Tauri commands organized by functional domain
 * Replaces the monolithic command registration in lib.rs
 */
pub mod agent;
pub mod app_lifecycle;
pub mod configuration;
pub mod container;
pub mod core;
pub mod data;
pub mod media;
pub mod testing;
pub mod websocket;

// Command modules - functions are used via module paths in lib.rs
// Re-exports commented out to eliminate unused import warnings