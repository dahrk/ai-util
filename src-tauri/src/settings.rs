//! Persisted settings — backed by `tauri-plugin-store`.
//!
//! M1 ships a stub that returns defaults and errors on mutation; the real
//! implementation lands in M3 alongside the LLM gateway (which needs API
//! keys). The function signatures here are stable so M3 only fills in bodies.

use thiserror::Error;

use crate::commands::settings::AppSettings;

#[derive(Error, Debug)]
pub enum SettingsError {
    #[error("settings unavailable: {0}")]
    Unavailable(String),

    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
}

/// Load the persisted settings, or defaults if the store doesn't yet exist.
///
/// M1: returns defaults. M3 wires up tauri-plugin-store.
pub async fn load(_app: &tauri::AppHandle) -> Result<AppSettings, SettingsError> {
    Ok(AppSettings::default())
}

/// Apply a mutator to the persisted settings and save the result.
///
/// M1: rejects mutations. M3 wires up the real read-modify-write path.
pub async fn mutate<F>(_app: &tauri::AppHandle, _f: F) -> Result<(), SettingsError>
where
    F: FnOnce(&mut AppSettings) -> Result<(), String>,
{
    Err(SettingsError::Unavailable(
        "settings persistence implemented in M3".into(),
    ))
}
