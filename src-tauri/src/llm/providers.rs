//! Provider definitions for the LLM gateway.
//!
//! Both providers expose OpenAI-compatible /chat/completions, so the request
//! shape is identical — only base URL, model, and headers differ.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Fireworks,
    OpenRouter,
}

impl Provider {
    pub fn label(self) -> &'static str {
        match self {
            Provider::Fireworks => "Fireworks",
            Provider::OpenRouter => "OpenRouter",
        }
    }

    pub fn url(self) -> &'static str {
        match self {
            Provider::Fireworks => "https://api.fireworks.ai/inference/v1/chat/completions",
            Provider::OpenRouter => "https://openrouter.ai/api/v1/chat/completions",
        }
    }

    pub fn default_model(self) -> &'static str {
        match self {
            Provider::Fireworks => "accounts/fireworks/models/llama-v3p1-8b-instruct",
            Provider::OpenRouter => "meta-llama/llama-3.1-8b-instruct",
        }
    }
}

/// A fully-resolved configuration for one provider call. `base_url` is `None`
/// in production (uses the provider default) and `Some` in tests (wiremock).
#[derive(Clone, Debug)]
pub struct ProviderConfig {
    pub provider: Provider,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

impl ProviderConfig {
    pub fn effective_url(&self) -> &str {
        self.base_url.as_deref().unwrap_or(self.provider.url())
    }
}
