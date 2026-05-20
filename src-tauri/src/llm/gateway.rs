//! Phase 4: the LLM gateway.
//!
//! Orchestrates Fireworks (primary) → OpenRouter (fallback) with streaming
//! and cancellation. A single reqwest::Client is shared across all calls.

use crate::llm::prompts::Message;
use crate::llm::providers::{Provider, ProviderConfig};
use once_cell::sync::OnceCell;
use reqwest::Client;
use std::time::Duration;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

static HTTP_CLIENT: OnceCell<Client> = OnceCell::new();

/// Phase 10: called from setup() at app launch to pre-warm the client.
pub fn init_client(_app: &AppHandle) {
    let _ = HTTP_CLIENT.set(
        Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(None)
            .http2_prior_knowledge() // remove if Fireworks doesn't support h2 with prior knowledge
            .build()
            .expect("reqwest client"),
    );
}

pub fn client() -> &'static Client {
    HTTP_CLIENT
        .get()
        .expect("HTTP_CLIENT not initialized — call init_client() in setup()")
}

/// Run a completion with provider fallback.
///
/// `on_token` is called for every streamed content chunk.
/// `on_provider_switch` is called when falling back from Fireworks to OpenRouter.
/// `cancel` is checked between chunks.
///
/// Returns the full concatenated response on success.
pub async fn run_completion(
    _messages: Vec<Message>,
    _fireworks: Option<ProviderConfig>,
    _openrouter: Option<ProviderConfig>,
    _on_token: impl FnMut(&str),
    _on_provider_switch: impl FnOnce(Provider, Provider),
    _cancel: CancellationToken,
) -> Result<String, GatewayError> {
    // TODO Phase 4:
    //   1. If fireworks config present, call call_provider(Fireworks, ...)
    //   2. If that returns Err, log warning, call on_provider_switch, fall through
    //   3. If openrouter config present, call call_provider(OpenRouter, ...)
    //   4. If both fail, return GatewayError::BothFailed { fireworks, openrouter }
    todo!("Phase 4")
}

#[derive(thiserror::Error, Debug)]
pub enum GatewayError {
    #[error("no providers configured")]
    NoProviders,

    #[error("cancelled")]
    Cancelled,

    #[error("both providers failed — fireworks: {fireworks:?}, openrouter: {openrouter:?}")]
    BothFailed {
        fireworks: Option<String>,
        openrouter: Option<String>,
    },
}
