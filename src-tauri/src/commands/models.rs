//! Tauri command that fetches a provider's live model catalog.
//!
//! The frontend uses this to populate the model dropdown in Settings +
//! Onboarding so we don't ship a hardcoded list that drifts.

use tauri::AppHandle;

use crate::llm::gateway;
use crate::llm::provider_impl::{provider_for, ModelInfo};
use crate::llm::providers::Provider;

#[tauri::command]
pub async fn fetch_models(app: AppHandle, provider: String) -> Result<Vec<ModelInfo>, String> {
    let kind = match provider.as_str() {
        "fireworks" => Provider::Fireworks,
        "openrouter" => Provider::OpenRouter,
        other => return Err(format!("unknown provider: {other}")),
    };

    let settings = crate::settings::load(&app)
        .await
        .map_err(|e| e.to_string())?;

    let key = match kind {
        Provider::Fireworks => settings.fireworks_key,
        Provider::OpenRouter => settings.openrouter_key,
    }
    .ok_or_else(|| "no API key configured".to_string())?;

    provider_for(kind)
        .fetch_models(gateway::client(), &key, None)
        .await
        .map_err(|e| format!("{e}"))
}
