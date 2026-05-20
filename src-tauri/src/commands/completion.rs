//! `run_completion` + `cancel_completion`.
//!
//! Resolves API keys from settings, builds prompts, spawns a task that calls
//! into `crate::llm::gateway`, and emits events to the panel for each
//! streamed token, provider switch, completion, or error.
//!
//! Events emitted to the `panel` window:
//!   - `completion_token`     `{ token: String }`
//!   - `provider_switched`    `{ from: String, to: String }`
//!   - `completion_done`      `{ text: String }`
//!   - `completion_error`     `{ fireworks_error?: String, openrouter_error?: String }`

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

use crate::llm::gateway::{self, GatewayError, TokenSink};
use crate::llm::prompts::{self, Action};
use crate::llm::providers::{Provider, ProviderConfig};
use crate::state::AppState;
use crate::util::{now_ms, PANEL_LABEL};

#[derive(Serialize, Clone, Debug)]
pub struct CompletionErrorPayload {
    pub fireworks_error: Option<String>,
    pub openrouter_error: Option<String>,
}

#[tauri::command]
pub async fn run_completion(app: AppHandle, action: Action, text: String) -> Result<(), String> {
    let settings = crate::settings::load(&app)
        .await
        .map_err(|e| e.to_string())?;

    let prompt_override = settings.prompts.get(action.as_key()).cloned();
    let messages = prompts::build_messages_with_override(action, &text, prompt_override.as_deref());

    let fireworks = settings.fireworks_key.as_ref().map(|k| ProviderConfig {
        provider: Provider::Fireworks,
        api_key: k.clone(),
        model: settings
            .fireworks_model
            .clone()
            .unwrap_or_else(|| Provider::Fireworks.default_model().to_string()),
        base_url: None,
    });
    let openrouter = settings.openrouter_key.as_ref().map(|k| ProviderConfig {
        provider: Provider::OpenRouter,
        api_key: k.clone(),
        model: settings
            .openrouter_model
            .clone()
            .unwrap_or_else(|| Provider::OpenRouter.default_model().to_string()),
        base_url: None,
    });

    if fireworks.is_none() && openrouter.is_none() {
        let err = CompletionErrorPayload {
            fireworks_error: Some("No Fireworks key configured.".into()),
            openrouter_error: Some("No OpenRouter key configured.".into()),
        };
        let _ = app.emit_to(PANEL_LABEL, "completion_error", &err);
        return Ok(());
    }

    // Install a fresh cancel token, replacing any prior in-flight one.
    let cancel = CancellationToken::new();
    {
        let state = app.state::<AppState>();
        let mut slot = state.cancel_token.lock();
        if let Some(prev) = slot.take() {
            prev.cancel();
        }
        *slot = Some(cancel.clone());
    }

    let first_token_emitted = Arc::new(AtomicBool::new(false));
    let app_for_token = app.clone();
    let first = first_token_emitted.clone();
    let on_token: TokenSink = gateway::token_sink(move |tok| {
        if !first.swap(true, Ordering::SeqCst) {
            let _ = app_for_token.emit_to(PANEL_LABEL, "telemetry_first_token", now_ms());
        }
        let _ = app_for_token.emit_to(
            PANEL_LABEL,
            "completion_token",
            TokenPayload {
                token: tok.to_string(),
            },
        );
    });
    let app_for_switch = app.clone();
    let on_switch = gateway::switch_sink(move |from, to| {
        let _ = app_for_switch.emit_to(
            PANEL_LABEL,
            "provider_switched",
            SwitchPayload {
                from: from.label().to_string(),
                to: to.label().to_string(),
            },
        );
    });

    let app_for_task = app.clone();
    tauri::async_runtime::spawn(async move {
        let result =
            gateway::run_completion(messages, fireworks, openrouter, on_token, on_switch, cancel)
                .await;

        {
            let state = app_for_task.state::<AppState>();
            let mut slot = state.cancel_token.lock();
            *slot = None;
        }

        match result {
            Ok(text) => {
                let _ = app_for_task.emit_to(PANEL_LABEL, "telemetry_completion_done", now_ms());
                let _ = app_for_task.emit_to(PANEL_LABEL, "completion_done", DonePayload { text });
            }
            Err(GatewayError::Cancelled) => {
                tracing::info!("completion cancelled");
            }
            Err(GatewayError::BothFailed {
                fireworks,
                openrouter,
            }) => {
                let err = CompletionErrorPayload {
                    fireworks_error: fireworks,
                    openrouter_error: openrouter,
                };
                let _ = app_for_task.emit_to(PANEL_LABEL, "completion_error", &err);
            }
            Err(other) => {
                let err = CompletionErrorPayload {
                    fireworks_error: Some(format!("{other}")),
                    openrouter_error: None,
                };
                let _ = app_for_task.emit_to(PANEL_LABEL, "completion_error", &err);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_completion(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut slot = state.cancel_token.lock();
    if let Some(token) = slot.take() {
        token.cancel();
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct TokenPayload {
    token: String,
}

#[derive(Serialize, Clone)]
struct SwitchPayload {
    from: String,
    to: String,
}

#[derive(Serialize, Clone)]
struct DonePayload {
    text: String,
}
