//! Persisted settings — backed by `tauri-plugin-store`.
//!
//! Stored as a single JSON document at `settings.json` inside the app's data
//! directory. Plaintext for v1 PoC — production should use the system
//! keychain via the `keyring` crate (TODO, tracked in `CLAUDE.md`).

use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use thiserror::Error;

use crate::commands::settings::AppSettings;

const STORE_PATH: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

#[derive(Error, Debug)]
pub enum SettingsError {
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("store error: {0}")]
    Store(#[from] tauri_plugin_store::Error),

    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("mutator rejected: {0}")]
    Rejected(String),
}

/// Load the persisted settings, or defaults if the store doesn't yet exist.
pub async fn load(app: &AppHandle) -> Result<AppSettings, SettingsError> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || load_blocking(&app))
        .await
        .map_err(|e| SettingsError::Rejected(format!("join: {e}")))?
}

fn load_blocking(app: &AppHandle) -> Result<AppSettings, SettingsError> {
    let store = app.store(STORE_PATH)?;
    let value = match store.get(SETTINGS_KEY) {
        Some(v) => v,
        None => return Ok(AppSettings::default()),
    };
    let settings: AppSettings = serde_json::from_value(value)?;
    Ok(settings)
}

/// Apply a mutator to the persisted settings and save the result.
///
/// The mutator may return an `Err(String)` to reject the change (validation
/// failures, unknown providers); we propagate that to the caller as
/// `SettingsError::Rejected`.
pub async fn mutate<F>(app: &AppHandle, f: F) -> Result<AppSettings, SettingsError>
where
    F: FnOnce(&mut AppSettings) -> Result<(), String> + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || mutate_blocking(&app, f))
        .await
        .map_err(|e| SettingsError::Rejected(format!("join: {e}")))?
}

fn mutate_blocking<F>(app: &AppHandle, f: F) -> Result<AppSettings, SettingsError>
where
    F: FnOnce(&mut AppSettings) -> Result<(), String>,
{
    let store = app.store(STORE_PATH)?;
    let mut settings: AppSettings = store
        .get(SETTINGS_KEY)
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();

    f(&mut settings).map_err(SettingsError::Rejected)?;

    let value: Value = serde_json::to_value(&settings)?;
    store.set(SETTINGS_KEY, value);
    store.save()?;
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use crate::commands::settings::AppSettings;

    #[test]
    fn defaults_have_no_keys() {
        // serde `default = "..."` only fires on *missing* fields, not on a
        // raw `Default::default()`. The seeding behavior lives at the
        // deserialize boundary — see `defaults_for_missing_fields_serve_as_seed`.
        let s = AppSettings::default();
        assert_eq!(s.fireworks_key, None);
        assert_eq!(s.openrouter_key, None);
        assert!(!s.onboarding_complete);
    }

    #[test]
    fn defaults_for_missing_fields_serve_as_seed() {
        // A settings JSON missing `enabled_actions` should seed the default 4.
        let partial = r#"{"fireworks_key":"abc"}"#;
        let settings: AppSettings = serde_json::from_str(partial).expect("parse");
        assert_eq!(settings.enabled_actions.len(), 4);
        assert!(settings.enabled_actions.contains(&"summarize".to_string()));
        assert_eq!(settings.fireworks_key.as_deref(), Some("abc"));
    }

    #[test]
    fn roundtrips_full_settings() {
        let mut prompts = std::collections::BTreeMap::new();
        prompts.insert("summarize".into(), "Make it haiku-shaped".into());
        let s = AppSettings {
            hotkey: None,
            fireworks_key: Some("fw-key".into()),
            openrouter_key: Some("or-key".into()),
            fireworks_model: Some("llama-fw".into()),
            openrouter_model: Some("llama-or".into()),
            onboarding_complete: true,
            enabled_actions: vec!["summarize".into(), "edit".into()],
            prompts,
        };

        let json = serde_json::to_string(&s).expect("serialize");
        let back: AppSettings = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back, s);
    }

    #[test]
    fn unknown_fields_are_ignored_on_load() {
        // Forward-compat: extra keys from a newer build don't break load.
        let raw = r#"{"unknown_field":"hi","fireworks_key":"k"}"#;
        let s: AppSettings = serde_json::from_str(raw).expect("parse");
        assert_eq!(s.fireworks_key.as_deref(), Some("k"));
    }
}
