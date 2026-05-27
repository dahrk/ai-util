//! Settings persistence + management commands.

use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::llm::prompts::Action;
use crate::llm::providers::Provider;

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq, Eq)]
pub struct AppSettings {
    pub hotkey: Option<String>,
    pub fireworks_key: Option<String>,
    pub openrouter_key: Option<String>,
    pub fireworks_model: Option<String>,
    pub openrouter_model: Option<String>,
    #[serde(default)]
    pub prompts: std::collections::BTreeMap<String, String>,
    #[serde(default = "default_enabled_actions")]
    pub enabled_actions: Vec<String>,
    #[serde(default)]
    pub onboarding_complete: bool,
    /// Developer toggle: when on, the floating panel doesn't auto-hide on
    /// blur and can be dragged. Useful for visually inspecting the panel
    /// without it disappearing.
    #[serde(default)]
    pub dev_panel_persistent: bool,
}

fn default_enabled_actions() -> Vec<String> {
    Action::ALL.iter().map(|a| a.as_key().to_string()).collect()
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
pub async fn set_dev_panel_persistent(app: AppHandle, value: bool) -> Result<AppSettings, String> {
    crate::settings::mutate(&app, move |s| {
        s.dev_panel_persistent = value;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_hotkey(app: AppHandle, shortcut: String) -> Result<AppSettings, String> {
    let shortcut_for_store = shortcut.clone();
    let settings = crate::settings::mutate(&app, move |s| {
        s.hotkey = Some(shortcut_for_store);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;

    crate::hotkey::reregister(&app, &shortcut).map_err(|e| e.to_string())?;
    Ok(settings)
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
pub async fn set_prompt_override(
    app: AppHandle,
    action: String,
    prompt: Option<String>,
) -> Result<AppSettings, String> {
    crate::settings::mutate(&app, move |s| {
        Action::from_str(&action)?;
        match prompt {
            Some(p) if !p.trim().is_empty() => {
                s.prompts.insert(action, p);
            }
            _ => {
                s.prompts.remove(&action);
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_enabled_actions(
    app: AppHandle,
    actions: Vec<String>,
) -> Result<AppSettings, String> {
    crate::settings::mutate(&app, move |s| {
        for a in &actions {
            Action::from_str(a)?;
        }
        s.enabled_actions = actions;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn complete_onboarding(app: AppHandle) -> Result<AppSettings, String> {
    let settings = crate::settings::mutate(&app, move |s| {
        s.onboarding_complete = true;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?;

    // Close the onboarding window if present.
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("onboarding") {
        let _ = win.close();
    }
    Ok(settings)
}

#[derive(Serialize, Debug, Clone)]
pub struct ValidationResult {
    pub ok: bool,
    pub status: Option<u16>,
    pub message: Option<String>,
}

/// Validate an API key by listing the provider's models. This proves the
/// key authenticates against the inference API without consuming tokens or
/// caring whether any particular model id is still deployed (the historical
/// "tiny completion" pattern 404'd when a default model rotated out).
#[tauri::command]
pub async fn validate_api_key(provider: String, key: String) -> Result<ValidationResult, String> {
    let provider_kind = match provider.as_str() {
        "fireworks" => Provider::Fireworks,
        "openrouter" => Provider::OpenRouter,
        other => return Err(format!("unknown provider: {other}")),
    };

    if key.trim().is_empty() {
        return Ok(ValidationResult {
            ok: false,
            status: None,
            message: Some("API key is empty".into()),
        });
    }

    use crate::llm::provider_impl::{provider_for, ProviderError};
    let result = provider_for(provider_kind)
        .fetch_models(crate::llm::gateway::client(), &key, None)
        .await;

    Ok(match result {
        Ok(_) => ValidationResult {
            ok: true,
            status: Some(200),
            message: None,
        },
        Err(ProviderError::Unauthorized(body)) => ValidationResult {
            ok: false,
            status: Some(401),
            message: Some(truncate(body, 200)),
        },
        Err(ProviderError::RateLimited(body)) => ValidationResult {
            ok: false,
            status: Some(429),
            message: Some(truncate(body, 200)),
        },
        Err(ProviderError::BadRequest(msg)) => ValidationResult {
            ok: false,
            status: Some(400),
            message: Some(truncate(msg, 200)),
        },
        Err(ProviderError::ServerError(msg)) => ValidationResult {
            ok: false,
            status: Some(500),
            message: Some(truncate(msg, 200)),
        },
        Err(ProviderError::Network(msg)) | Err(ProviderError::Malformed(msg)) => ValidationResult {
            ok: false,
            status: None,
            message: Some(truncate(msg, 200)),
        },
    })
}

fn truncate(s: String, max: usize) -> String {
    s.chars().take(max).collect()
}

/// Probe the A11y permission by attempting a selection capture and inspecting
/// the resulting error. Used by onboarding to advance once the user has
/// granted access in System Settings.
#[tauri::command]
pub async fn probe_accessibility() -> Result<bool, String> {
    Ok(crate::selection::has_accessibility())
}
