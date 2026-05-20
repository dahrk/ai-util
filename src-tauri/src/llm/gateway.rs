//! LLM gateway — Fireworks primary, OpenRouter fallback.
//!
//! ## Provider-switch contract
//!
//! When Fireworks fails and we fall back to OpenRouter, the gateway calls
//! `on_provider_switch(Fireworks, OpenRouter)` BEFORE yielding any
//! OpenRouter tokens. The frontend store resets the token buffer on
//! `provider_switched`, so the ordering matters: if any OpenRouter tokens
//! arrived first, the reset would wipe them.
//!
//! ## Cancellation
//!
//! The cancel token is checked between chunks. A cancelled stream is
//! dropped (closing the reqwest response stream); `GatewayError::Cancelled`
//! is returned to the caller.
//!
//! ## HTTP/2
//!
//! `init_client` enables HTTP/2 via ALPN (the `http2_prior_knowledge`
//! optimization is intentionally OFF — at the time of writing Fireworks's
//! TLS terminator was sensitive to it). Revisit in M6 if it helps latency
//! on the first byte.

use std::sync::Arc;
use std::time::Duration;

use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Client, Response, StatusCode};
use serde::Serialize;
use tauri::AppHandle;
use thiserror::Error;
use tokio_util::sync::CancellationToken;

use crate::llm::prompts::Message;
use crate::llm::providers::{Provider, ProviderConfig};
use crate::llm::sse::parse_data_line;

static HTTP_CLIENT: OnceCell<Client> = OnceCell::new();

/// Called from `setup()` to construct a shared HTTP client with connection
/// pooling tuned for streaming.
pub fn init_client(_app: &AppHandle) {
    let _ = HTTP_CLIENT.set(
        Client::builder()
            .connect_timeout(Duration::from_secs(10))
            // No read timeout — streams can pause between tokens.
            .pool_idle_timeout(None)
            .pool_max_idle_per_host(4)
            .build()
            .expect("reqwest client"),
    );
}

pub fn client() -> &'static Client {
    HTTP_CLIENT
        .get()
        .expect("HTTP_CLIENT not initialized — call init_client() in setup()")
}

/// Integration-test entry point. Idempotent. Not exposed in the production
/// surface — the `__test_support` re-export is `#[doc(hidden)]`.
#[doc(hidden)]
pub fn __init_client_for_tests() {
    let _ = HTTP_CLIENT.set(
        Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(None)
            .build()
            .expect("test client"),
    );
}

#[derive(Serialize)]
struct ChatBody<'a> {
    model: &'a str,
    messages: &'a [Message],
    stream: bool,
    temperature: f32,
}

/// A boxed mutable token callback. Used so the gateway can be called from
/// `tauri::async_runtime::spawn` (the closure needs `Send`).
pub type TokenSink = Arc<Mutex<dyn FnMut(&str) + Send + 'static>>;

/// Provider-switch callback. Boxed for the same `Send` reason.
pub type SwitchSink = Arc<Mutex<dyn FnMut(Provider, Provider) + Send + 'static>>;

pub fn token_sink<F: FnMut(&str) + Send + 'static>(f: F) -> TokenSink {
    Arc::new(Mutex::new(f))
}
pub fn switch_sink<F: FnMut(Provider, Provider) + Send + 'static>(f: F) -> SwitchSink {
    Arc::new(Mutex::new(f))
}

/// Run a completion with provider fallback. Returns the full concatenated
/// response on success.
pub async fn run_completion(
    messages: Vec<Message>,
    fireworks: Option<ProviderConfig>,
    openrouter: Option<ProviderConfig>,
    on_token: TokenSink,
    on_provider_switch: SwitchSink,
    cancel: CancellationToken,
) -> Result<String, GatewayError> {
    let mut fireworks_err: Option<String> = None;
    let mut openrouter_err: Option<String> = None;

    if fireworks.is_none() && openrouter.is_none() {
        return Err(GatewayError::NoProviders);
    }

    // Try Fireworks first.
    if let Some(cfg) = &fireworks {
        match stream_one(cfg, &messages, on_token.clone(), cancel.clone()).await {
            Ok(text) => return Ok(text),
            Err(GatewayError::Cancelled) => return Err(GatewayError::Cancelled),
            Err(e) => {
                tracing::warn!("Fireworks failed: {e}");
                fireworks_err = Some(format!("{e}"));
            }
        }
    }

    // Fall back to OpenRouter. Per contract: emit `provider_switched` BEFORE
    // the first OpenRouter token (here, before the request even fires).
    if let Some(cfg) = &openrouter {
        if fireworks.is_some() {
            (on_provider_switch.lock())(Provider::Fireworks, Provider::OpenRouter);
        }
        match stream_one(cfg, &messages, on_token.clone(), cancel.clone()).await {
            Ok(text) => return Ok(text),
            Err(GatewayError::Cancelled) => return Err(GatewayError::Cancelled),
            Err(e) => {
                tracing::warn!("OpenRouter failed: {e}");
                openrouter_err = Some(format!("{e}"));
            }
        }
    }

    Err(GatewayError::BothFailed {
        fireworks: fireworks_err,
        openrouter: openrouter_err,
    })
}

async fn stream_one(
    cfg: &ProviderConfig,
    messages: &[Message],
    on_token: TokenSink,
    cancel: CancellationToken,
) -> Result<String, GatewayError> {
    let body = ChatBody {
        model: &cfg.model,
        messages,
        stream: true,
        temperature: 0.3,
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", cfg.api_key))
            .map_err(|_| GatewayError::BadRequest("invalid API key header".into()))?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    // OpenRouter wants attribution headers — harmless on Fireworks.
    headers.insert(
        "HTTP-Referer",
        HeaderValue::from_static("https://github.com/anthropics/claude-code"),
    );
    headers.insert("X-Title", HeaderValue::from_static("AI Text Actions"));

    let send_fut = client()
        .post(cfg.effective_url())
        .headers(headers)
        .json(&body)
        .send();

    let res = tokio::select! {
        biased;
        _ = cancel.cancelled() => return Err(GatewayError::Cancelled),
        r = send_fut => r,
    };
    let res: Response = res.map_err(|e| GatewayError::Network(e.to_string()))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        let truncated: String = body.chars().take(300).collect();
        return Err(http_status_to_err(status, truncated));
    }

    let mut buffer = String::new();
    let stream = res.bytes_stream().eventsource();
    futures_util::pin_mut!(stream);

    loop {
        tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err(GatewayError::Cancelled),
            ev = stream.next() => match ev {
                None => break,
                Some(Err(e)) => return Err(GatewayError::Stream(e.to_string())),
                Some(Ok(event)) => {
                    let payload = format!("data: {}", event.data);
                    match parse_data_line(&payload) {
                        Ok(Some(tok)) => {
                            buffer.push_str(&tok);
                            (on_token.lock())(&tok);
                        }
                        Ok(None) => continue,
                        Err(e) => {
                            // Malformed JSON in a stream chunk is non-fatal — log and skip.
                            tracing::warn!("sse parse: {e}");
                        }
                    }
                }
            }
        }
    }

    Ok(buffer)
}

fn http_status_to_err(status: StatusCode, body: String) -> GatewayError {
    if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        GatewayError::Unauthorized(body)
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        GatewayError::RateLimited(body)
    } else if status.is_client_error() {
        GatewayError::BadRequest(format!("{status}: {body}"))
    } else {
        GatewayError::ServerError(format!("{status}: {body}"))
    }
}

#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("no providers configured")]
    NoProviders,

    #[error("cancelled")]
    Cancelled,

    #[error("network: {0}")]
    Network(String),

    #[error("stream: {0}")]
    Stream(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("rate limited: {0}")]
    RateLimited(String),

    #[error("server error: {0}")]
    ServerError(String),

    #[error("both providers failed — fireworks: {fireworks:?}, openrouter: {openrouter:?}")]
    BothFailed {
        fireworks: Option<String>,
        openrouter: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::prompts::{build_messages, Action};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;
    use wiremock::matchers::{header, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn init() {
        // Ensure the shared HTTP client exists for tests.
        let _ = HTTP_CLIENT.set(Client::builder().build().expect("client"));
    }

    fn sse_body(chunks: &[&str]) -> String {
        let mut s = String::new();
        for c in chunks {
            s.push_str(&format!(
                "data: {{\"choices\":[{{\"delta\":{{\"content\":\"{}\"}}}}]}}\n\n",
                c
            ));
        }
        s.push_str("data: [DONE]\n\n");
        s
    }

    async fn mock_streaming(server: &MockServer, chunks: &[&str]) {
        Mock::given(method("POST"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("Content-Type", "text/event-stream")
                    .set_body_string(sse_body(chunks)),
            )
            .mount(server)
            .await;
    }

    fn cfg(url: String, provider: Provider) -> ProviderConfig {
        ProviderConfig {
            provider,
            api_key: "test-key".into(),
            model: "test-model".into(),
            base_url: Some(url),
        }
    }

    #[tokio::test]
    async fn happy_path_streams_tokens_in_order() {
        init();
        let server = MockServer::start().await;
        mock_streaming(&server, &["Hello", ", ", "world", "!"]).await;

        let received = Arc::new(Mutex::new(Vec::<String>::new()));
        let r2 = received.clone();
        let on_token = token_sink(move |t| r2.lock().push(t.to_string()));
        let on_switch = switch_sink(|_, _| panic!("should not switch"));

        let result = run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(server.uri(), Provider::Fireworks)),
            None,
            on_token,
            on_switch,
            CancellationToken::new(),
        )
        .await
        .expect("happy path");

        assert_eq!(result, "Hello, world!");
        assert_eq!(*received.lock(), vec!["Hello", ", ", "world", "!"]);
    }

    #[tokio::test]
    async fn fireworks_401_falls_back_to_openrouter() {
        init();
        let fireworks = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(401).set_body_string("bad key"))
            .mount(&fireworks)
            .await;

        let openrouter = MockServer::start().await;
        mock_streaming(&openrouter, &["fallback", " ok"]).await;

        let switch_calls = Arc::new(AtomicUsize::new(0));
        let sc = switch_calls.clone();
        let on_switch = switch_sink(move |from, to| {
            sc.fetch_add(1, Ordering::SeqCst);
            assert_eq!(from, Provider::Fireworks);
            assert_eq!(to, Provider::OpenRouter);
        });

        let received = Arc::new(Mutex::new(String::new()));
        let r2 = received.clone();
        let on_token = token_sink(move |t| r2.lock().push_str(t));

        let res = run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(fireworks.uri(), Provider::Fireworks)),
            Some(cfg(openrouter.uri(), Provider::OpenRouter)),
            on_token,
            on_switch,
            CancellationToken::new(),
        )
        .await
        .expect("fallback should succeed");

        assert_eq!(res, "fallback ok");
        assert_eq!(switch_calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn both_providers_fail_returns_both_errors() {
        init();
        let f = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&f)
            .await;
        let o = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(503).set_body_string("nope"))
            .mount(&o)
            .await;

        let err = run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(f.uri(), Provider::Fireworks)),
            Some(cfg(o.uri(), Provider::OpenRouter)),
            token_sink(|_| {}),
            switch_sink(|_, _| {}),
            CancellationToken::new(),
        )
        .await
        .expect_err("both should fail");

        match err {
            GatewayError::BothFailed {
                fireworks,
                openrouter,
            } => {
                assert!(fireworks.is_some(), "fireworks error should be captured");
                assert!(openrouter.is_some(), "openrouter error should be captured");
            }
            other => panic!("expected BothFailed, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn cancel_mid_stream_returns_cancelled() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("Content-Type", "text/event-stream")
                    .set_body_string(sse_body(&["one", "two", "three"]))
                    .set_delay(Duration::from_millis(500)),
            )
            .mount(&server)
            .await;

        let cancel = CancellationToken::new();
        let c2 = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(50)).await;
            c2.cancel();
        });

        let err = run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(server.uri(), Provider::Fireworks)),
            None,
            token_sink(|_| {}),
            switch_sink(|_, _| {}),
            cancel,
        )
        .await
        .expect_err("cancel should error");

        assert!(matches!(err, GatewayError::Cancelled), "got {err:?}");
    }

    #[tokio::test]
    async fn provider_switch_callback_fires_exactly_once_on_fallback() {
        init();
        let f = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(429).set_body_string("rate limit"))
            .mount(&f)
            .await;
        let o = MockServer::start().await;
        mock_streaming(&o, &["x"]).await;

        let count = Arc::new(AtomicUsize::new(0));
        let c2 = count.clone();
        let on_switch = switch_sink(move |_, _| {
            c2.fetch_add(1, Ordering::SeqCst);
        });

        run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(f.uri(), Provider::Fireworks)),
            Some(cfg(o.uri(), Provider::OpenRouter)),
            token_sink(|_| {}),
            on_switch,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        assert_eq!(count.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn auth_header_is_set_correctly() {
        init();
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(header("authorization", "Bearer test-key"))
            .and(header("content-type", "application/json"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("Content-Type", "text/event-stream")
                    .set_body_string(sse_body(&["ok"])),
            )
            .mount(&server)
            .await;

        let res = run_completion(
            build_messages(Action::Summarize, "hi"),
            Some(cfg(server.uri(), Provider::Fireworks)),
            None,
            token_sink(|_| {}),
            switch_sink(|_, _| {}),
            CancellationToken::new(),
        )
        .await
        .unwrap();

        assert_eq!(res, "ok");
    }

    #[tokio::test]
    async fn no_providers_returns_no_providers_error() {
        init();
        let err = run_completion(
            build_messages(Action::Summarize, "hi"),
            None,
            None,
            token_sink(|_| {}),
            switch_sink(|_, _| {}),
            CancellationToken::new(),
        )
        .await
        .expect_err("expected NoProviders");
        assert!(matches!(err, GatewayError::NoProviders));
    }
}
