//! Per-provider trait + factory for the operations whose implementation
//! differs between Fireworks and OpenRouter.
//!
//! Today that's just `fetch_models` — the streaming completion still goes
//! through `gateway::stream_one`, which is provider-agnostic because both
//! providers speak OpenAI-compatible `/chat/completions`. `/v1/models`, by
//! contrast, returns provider-specific JSON shapes that need their own
//! deserialization, so a trait + factory beats branching inside the gateway.
//!
//! The `base_url_override` parameter on `fetch_models` is the wiremock seam,
//! matching the `ProviderConfig.base_url` pattern used in `gateway.rs`.
//!
//! **Fireworks gotcha:** `/v1/models` is account-scoped to serverless
//! deployments — it returns only what the API key can call right now, not
//! the full Fireworks catalog. Different accounts see different lists.

use async_trait::async_trait;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::llm::providers::Provider;

/// One row in a provider's model catalog. `label` is `None` when the
/// provider's `/v1/models` doesn't surface a friendly name — UI falls back
/// to showing the raw `id`.
#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub label: Option<String>,
}

#[derive(Error, Debug)]
pub enum ProviderError {
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("rate limited: {0}")]
    RateLimited(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("server error: {0}")]
    ServerError(String),

    #[error("network: {0}")]
    Network(String),

    #[error("malformed response: {0}")]
    Malformed(String),
}

fn status_to_provider_err(status: StatusCode, body: String) -> ProviderError {
    if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        ProviderError::Unauthorized(body)
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        ProviderError::RateLimited(body)
    } else if status.is_client_error() {
        ProviderError::BadRequest(format!("{status}: {body}"))
    } else {
        ProviderError::ServerError(format!("{status}: {body}"))
    }
}

#[async_trait]
pub trait ProviderImpl: Send + Sync {
    fn kind(&self) -> Provider;
    fn label(&self) -> &'static str;
    fn chat_url(&self) -> &'static str;
    fn models_url(&self) -> &'static str;
    fn default_model(&self) -> &'static str;

    /// Fetch the live model catalog. `base_url_override`, when `Some`,
    /// replaces the provider's hostname for both `chat_url` and `models_url`
    /// — used by tests to point at a wiremock server.
    async fn fetch_models(
        &self,
        client: &Client,
        api_key: &str,
        base_url_override: Option<&str>,
    ) -> Result<Vec<ModelInfo>, ProviderError>;
}

/// Build the URL for this provider's `/v1/models` endpoint, optionally with
/// the host replaced for testing. The override convention: caller passes the
/// wiremock root (e.g. `http://127.0.0.1:PORT`); we append the path tail.
fn models_endpoint(default_url: &str, override_url: Option<&str>, path_tail: &str) -> String {
    match override_url {
        Some(base) => format!("{base}{path_tail}"),
        None => default_url.to_string(),
    }
}

async fn fetch_models_generic<R, F>(
    client: &Client,
    api_key: &str,
    url: &str,
    parse: F,
) -> Result<Vec<ModelInfo>, ProviderError>
where
    R: for<'de> Deserialize<'de>,
    F: FnOnce(R) -> Vec<ModelInfo>,
{
    let res = client
        .get(url)
        .bearer_auth(api_key)
        // OpenRouter wants these for attribution; harmless on Fireworks.
        .header("HTTP-Referer", "https://github.com/anthropics/claude-code")
        .header("X-Title", "AI Text Actions")
        .send()
        .await
        .map_err(|e| ProviderError::Network(e.to_string()))?;

    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        let truncated: String = body.chars().take(300).collect();
        return Err(status_to_provider_err(status, truncated));
    }

    let parsed: R = res
        .json()
        .await
        .map_err(|e| ProviderError::Malformed(e.to_string()))?;
    Ok(parse(parsed))
}

// -------- Fireworks --------

pub struct FireworksProvider;

#[derive(Deserialize)]
struct FireworksModelsResponse {
    #[serde(default)]
    data: Vec<FireworksModelRow>,
}

#[derive(Deserialize)]
struct FireworksModelRow {
    id: String,
}

#[async_trait]
impl ProviderImpl for FireworksProvider {
    fn kind(&self) -> Provider {
        Provider::Fireworks
    }
    fn label(&self) -> &'static str {
        "Fireworks"
    }
    fn chat_url(&self) -> &'static str {
        "https://api.fireworks.ai/inference/v1/chat/completions"
    }
    fn models_url(&self) -> &'static str {
        "https://api.fireworks.ai/inference/v1/models"
    }
    fn default_model(&self) -> &'static str {
        // gpt-oss-20b is on the typical Fireworks serverless plan and is the
        // cheapest/smallest text-capable option there — good TTFT default.
        "accounts/fireworks/models/gpt-oss-20b"
    }

    async fn fetch_models(
        &self,
        client: &Client,
        api_key: &str,
        base_url_override: Option<&str>,
    ) -> Result<Vec<ModelInfo>, ProviderError> {
        // page_size=20 covers the typical serverless deployment count without
        // truncation. Harmless if Fireworks ignores or returns fewer.
        // models_endpoint() returns the bare URL in production (no override);
        // append the query suffix so the param lands in both prod and tests.
        let base = models_endpoint(self.models_url(), base_url_override, "/v1/models");
        let url = format!("{base}?page_size=20");
        fetch_models_generic::<FireworksModelsResponse, _>(client, api_key, &url, |r| {
            r.data
                .into_iter()
                .map(|row| ModelInfo {
                    id: row.id,
                    // Fireworks /v1/models has no friendly name — use the
                    // deployment scope as the label so the picker surfaces it.
                    label: Some("serverless".into()),
                })
                .collect()
        })
        .await
    }
}

// -------- OpenRouter --------

pub struct OpenRouterProvider;

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    #[serde(default)]
    data: Vec<OpenRouterModelRow>,
}

#[derive(Deserialize)]
struct OpenRouterModelRow {
    id: String,
    #[serde(default)]
    name: Option<String>,
}

#[async_trait]
impl ProviderImpl for OpenRouterProvider {
    fn kind(&self) -> Provider {
        Provider::OpenRouter
    }
    fn label(&self) -> &'static str {
        "OpenRouter"
    }
    fn chat_url(&self) -> &'static str {
        "https://openrouter.ai/api/v1/chat/completions"
    }
    fn models_url(&self) -> &'static str {
        "https://openrouter.ai/api/v1/models"
    }
    fn default_model(&self) -> &'static str {
        "meta-llama/llama-3.3-70b-instruct"
    }

    async fn fetch_models(
        &self,
        client: &Client,
        api_key: &str,
        base_url_override: Option<&str>,
    ) -> Result<Vec<ModelInfo>, ProviderError> {
        let url = models_endpoint(self.models_url(), base_url_override, "/v1/models");
        fetch_models_generic::<OpenRouterModelsResponse, _>(client, api_key, &url, |r| {
            r.data
                .into_iter()
                .map(|row| ModelInfo {
                    id: row.id,
                    label: row.name,
                })
                .collect()
        })
        .await
    }
}

// -------- Factory --------

static FIREWORKS: FireworksProvider = FireworksProvider;
static OPENROUTER: OpenRouterProvider = OpenRouterProvider;

pub fn provider_for(kind: Provider) -> &'static dyn ProviderImpl {
    match kind {
        Provider::Fireworks => &FIREWORKS,
        Provider::OpenRouter => &OPENROUTER,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::gateway;
    use serde_json::json;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn init() {
        gateway::__init_client_for_tests();
    }

    #[tokio::test]
    async fn fireworks_fetch_models_parses_response() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/models"))
            .and(header("authorization", "Bearer test-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "data": [
                    { "id": "accounts/fireworks/models/llama-v3p3-70b-instruct" },
                    { "id": "accounts/fireworks/models/llama4-scout-instruct-basic" },
                ]
            })))
            .mount(&server)
            .await;

        let result = FireworksProvider
            .fetch_models(gateway::client(), "test-key", Some(&server.uri()))
            .await
            .expect("happy path");

        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0].id,
            "accounts/fireworks/models/llama-v3p3-70b-instruct"
        );
        assert_eq!(
            result[0].label.as_deref(),
            Some("serverless"),
            "Fireworks rows get a 'serverless' scope label",
        );
    }

    #[tokio::test]
    async fn openrouter_fetch_models_uses_name_as_label() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/models"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "data": [
                    { "id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B Instruct" },
                    { "id": "anthropic/claude-haiku-4-5" },
                ]
            })))
            .mount(&server)
            .await;

        let result = OpenRouterProvider
            .fetch_models(gateway::client(), "test-key", Some(&server.uri()))
            .await
            .expect("happy path");

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].label.as_deref(), Some("Llama 3.3 70B Instruct"));
        assert!(result[1].label.is_none(), "row without name → label None");
    }

    #[tokio::test]
    async fn fetch_models_401_returns_unauthorized() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/models"))
            .respond_with(ResponseTemplate::new(401).set_body_string("bad key"))
            .mount(&server)
            .await;

        let err = FireworksProvider
            .fetch_models(gateway::client(), "wrong", Some(&server.uri()))
            .await
            .expect_err("401 should error");

        assert!(
            matches!(&err, ProviderError::Unauthorized(body) if body.contains("bad key")),
            "got: {err:?}"
        );
    }

    #[tokio::test]
    async fn fetch_models_429_returns_rate_limited() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(429).set_body_string("slow down"))
            .mount(&server)
            .await;

        let err = OpenRouterProvider
            .fetch_models(gateway::client(), "k", Some(&server.uri()))
            .await
            .expect_err("429 should error");

        assert!(matches!(err, ProviderError::RateLimited(_)), "got: {err:?}");
    }

    #[tokio::test]
    async fn fetch_models_empty_data_returns_empty_vec() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "data": [] })))
            .mount(&server)
            .await;

        let result = FireworksProvider
            .fetch_models(gateway::client(), "k", Some(&server.uri()))
            .await
            .expect("empty data is still ok");
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn fetch_models_malformed_json_returns_malformed() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not json"))
            .mount(&server)
            .await;

        let err = FireworksProvider
            .fetch_models(gateway::client(), "k", Some(&server.uri()))
            .await
            .expect_err("malformed should error");
        assert!(matches!(err, ProviderError::Malformed(_)), "got: {err:?}");
    }

    #[test]
    fn factory_returns_correct_kind() {
        assert_eq!(
            provider_for(Provider::Fireworks).kind(),
            Provider::Fireworks
        );
        assert_eq!(
            provider_for(Provider::OpenRouter).kind(),
            Provider::OpenRouter
        );
    }
}
