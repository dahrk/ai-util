//! M3 / M5: settings persistence + management commands.
//!
//! Schema lives here so multiple modules can share it. Real load/save logic
//! is in `crate::settings`.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq, Eq)]
pub struct AppSettings {
    pub hotkey: Option<String>,
    pub fireworks_key: Option<String>,
    pub openrouter_key: Option<String>,
    pub fireworks_model: Option<String>,
    pub openrouter_model: Option<String>,

    /// Optional per-action prompt overrides (M5). Keyed by lowercase action
    /// name (`"summarize"` etc.). Absent = "use the built-in default from
    /// `crate::llm::prompts`".
    #[serde(default)]
    pub prompts: std::collections::BTreeMap<String, String>,

    /// Set of actions the user has enabled (M5). Order is preserved for the
    /// picker list.
    #[serde(default = "default_enabled_actions")]
    pub enabled_actions: Vec<String>,

    #[serde(default)]
    pub onboarding_complete: bool,
}

fn default_enabled_actions() -> Vec<String> {
    vec![
        "summarize".into(),
        "edit".into(),
        "elaborate".into(),
        "research".into(),
    ]
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    crate::settings::load(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_api_key(
    app: AppHandle,
    provider: String,
    key: String,
) -> Result<AppSettings, String> {
    crate::settings::mutate(&app, move |s| {
        let value = if key.is_empty() { None } else { Some(key) };
        match provider.as_str() {
            "fireworks" => s.fireworks_key = value,
            "openrouter" => s.openrouter_key = value,
            other => return Err(format!("unknown provider: {other}")),
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_hotkey(_app: AppHandle, _shortcut: String) -> Result<(), String> {
    Err("set_hotkey: implemented in M5".into())
}

#[tauri::command]
pub async fn set_model(
    app: AppHandle,
    provider: String,
    model: String,
) -> Result<AppSettings, String> {
    crate::settings::mutate(&app, move |s| {
        let value = if model.is_empty() { None } else { Some(model) };
        match provider.as_str() {
            "fireworks" => s.fireworks_model = value,
            "openrouter" => s.openrouter_model = value,
            other => return Err(format!("unknown provider: {other}")),
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn complete_onboarding(_app: AppHandle) -> Result<(), String> {
    Err("complete_onboarding: implemented in M5".into())
}

#[tauri::command]
pub async fn validate_api_key(
    _app: AppHandle,
    _provider: String,
    _key: String,
) -> Result<(), String> {
    Err("validate_api_key: implemented in M5".into())
}
