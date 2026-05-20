//! Provider definitions for the LLM gateway.
//!
//! Both providers expose OpenAI-compatible /chat/completions, so the request
//! shape is identical — only baseURL, model, and headers differ.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provider {
    Fireworks,
    OpenRouter,
}

impl Provider {
    pub fn label(&self) -> &'static str {
        match self {
            Provider::Fireworks => "Fireworks",
            Provider::OpenRouter => "OpenRouter",
        }
    }

    pub fn url(&self) -> &'static str {
        match self {
            Provider::Fireworks => "https://api.fireworks.ai/inference/v1/chat/completions",
            Provider::OpenRouter => "https://openrouter.ai/api/v1/chat/completions",
        }
    }

    pub fn default_model(&self) -> &'static str {
        match self {
            Provider::Fireworks => "accounts/fireworks/models/llama-v3p1-8b-instruct",
            Provider::OpenRouter => "meta-llama/llama-3.1-8b-instruct",
        }
    }
}

pub struct ProviderConfig {
    pub provider: Provider,
    pub api_key: String,
    pub model: String,
}
