//! Tauri commands callable from the frontend via `invoke`.
//!
//! Keep this layer thin: parse args, call into the appropriate Rust module,
//! map errors to a serializable type, return. Business logic lives elsewhere.

pub mod completion;
pub mod models;
pub mod selection;
pub mod settings;
pub mod window;
