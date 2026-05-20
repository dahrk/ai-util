//! M3 / M5: settings persistence + management commands.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

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
        if !matches!(
            action.as_str(),
            "summarize" | "edit" | "elaborate" | "research"
        ) {
            return Err(format!("unknown action: {action}"));
        }
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
            if !matches!(a.as_str(), "summarize" | "edit" | "elaborate" | "research") {
                return Err(format!("unknown action: {a}"));
            }
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

/// Validate an API key by making a minimal completion request to the
/// provider. The "tiny test request" pattern: 1-token max, deterministic.
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

    let url = provider_kind.url();
    let model = provider_kind.default_model();
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "stream": false,
        "max_tokens": 1,
        "temperature": 0.0,
    });

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let res = client
        .post(url)
        .bearer_auth(&key)
        .header("HTTP-Referer", "https://github.com/anthropics/claude-code")
        .header("X-Title", "AI Text Actions")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;

    let status = res.status();
    if status.is_success() {
        Ok(ValidationResult {
            ok: true,
            status: Some(status.as_u16()),
            message: None,
        })
    } else {
        let snippet: String = res
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(200)
            .collect();
        Ok(ValidationResult {
            ok: false,
            status: Some(status.as_u16()),
            message: Some(snippet),
        })
    }
}

/// Probe the A11y permission by attempting a selection capture and inspecting
/// the resulting error. Used by onboarding to advance once the user has
/// granted access in System Settings.
#[tauri::command]
pub async fn probe_accessibility() -> Result<bool, String> {
    Ok(crate::selection::has_accessibility())
}
