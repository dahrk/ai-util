//! Phase 5: run_completion + cancel_completion.
//!
//! Spawns a task that calls into `crate::llm::gateway`, emitting events for
//! each streamed token, provider switches, and final completion.
//!
//! Events emitted to the panel window:
//!   - "completion_token"      { token: String }
//!   - "provider_switched"     { from: String, to: String }
//!   - "completion_done"       { text: String }
//!   - "completion_error"      { fireworks_error?: String, openrouter_error?: String }

use serde::Deserialize;
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Summarize,
    Edit,
    Elaborate,
    Research,
}

#[tauri::command]
pub async fn run_completion(_app: AppHandle, _action: Action, _text: String) -> Result<(), String> {
    // TODO Phase 5:
    //   - resolve API keys from settings store
    //   - build messages from crate::llm::prompts::build_messages
    //   - spawn a tokio task that calls gateway::run_completion
    //     passing closures that emit events
    //   - store the cancellation token on app state for cancel_completion
    todo!("Phase 5")
}

#[tauri::command]
pub async fn cancel_completion(_app: AppHandle) -> Result<(), String> {
    // TODO Phase 5:
    //   - trigger the stored cancellation token if present
    todo!("Phase 5")
}
