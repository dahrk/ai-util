//! Provider enum + flat-config struct used by the streaming gateway.
//!
//! Provider-specific implementation details (per-provider URLs, default
//! model, `/v1/models` deserialization) live in
//! `crate::llm::provider_impl`. The methods on `Provider` here are thin
//! delegates so call sites that only need a string don't have to know
//! about the trait.

use serde::{Deserialize, Serialize};

use crate::llm::provider_impl::provider_for;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Fireworks,
    OpenRouter,
}

impl Provider {
    pub fn label(self) -> &'static str {
        provider_for(self).label()
    }

    pub fn url(self) -> &'static str {
        provider_for(self).chat_url()
    }

    pub fn default_model(self) -> &'static str {
        provider_for(self).default_model()
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
