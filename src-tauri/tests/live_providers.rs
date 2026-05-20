//! Live integration tests against real Fireworks / OpenRouter endpoints.
//!
//! All tests in this file are `#[ignore]` — they require API keys via env
//! vars and incur cost / rate limiting. Run them explicitly:
//!
//! ```
//! FIREWORKS_API_KEY=... OPENROUTER_API_KEY=... \
//!   cargo test --test live_providers -- --ignored
//! ```
//!
//! Each test no-ops with an informative `eprintln!` if its env key is unset,
//! so running the file without keys never fails.
//!
//! These tests exercise the *gateway*, not the Tauri command layer, so they
//! don't require a running app.

use std::env;
use std::sync::Arc;

use ai_text_actions_lib::__test_support as t;
use parking_lot::Mutex;
use tokio_util::sync::CancellationToken;

#[tokio::test]
#[ignore = "live network — set FIREWORKS_API_KEY and run with --ignored"]
async fn summarize_via_fireworks_streams_tokens() {
    let Some(key) = env::var("FIREWORKS_API_KEY").ok() else {
        eprintln!("skipping: FIREWORKS_API_KEY not set");
        return;
    };

    t::init_client_for_tests();

    let received = Arc::new(Mutex::new(String::new()));
    let r = received.clone();
    let on_token = t::token_sink(move |tok| r.lock().push_str(tok));
    let on_switch = t::switch_sink(|_, _| {});

    let cfg = t::ProviderConfig {
        provider: t::Provider::Fireworks,
        api_key: key,
        model: t::Provider::Fireworks.default_model().to_string(),
        base_url: None,
    };

    let result = t::run_completion(
        t::build_messages(
            t::Action::Summarize,
            "The early returns from our Q3 campaign show a 24% lift in engagement.",
        ),
        Some(cfg),
        None,
        on_token,
        on_switch,
        CancellationToken::new(),
    )
    .await
    .expect("fireworks completion");

    assert!(!result.is_empty(), "expected some response, got empty");
    let buffered = received.lock().clone();
    assert_eq!(
        buffered, result,
        "on_token stream should reconstruct the full response",
    );
}

#[tokio::test]
#[ignore = "live network — set OPENROUTER_API_KEY and run with --ignored"]
async fn summarize_via_openrouter_streams_tokens() {
    let Some(key) = env::var("OPENROUTER_API_KEY").ok() else {
        eprintln!("skipping: OPENROUTER_API_KEY not set");
        return;
    };

    t::init_client_for_tests();

    let received = Arc::new(Mutex::new(String::new()));
    let r = received.clone();
    let on_token = t::token_sink(move |tok| r.lock().push_str(tok));
    let on_switch = t::switch_sink(|_, _| {});

    let cfg = t::ProviderConfig {
        provider: t::Provider::OpenRouter,
        api_key: key,
        model: t::Provider::OpenRouter.default_model().to_string(),
        base_url: None,
    };

    let result = t::run_completion(
        t::build_messages(t::Action::Edit, "Hello, World!"),
        None,
        Some(cfg),
        on_token,
        on_switch,
        CancellationToken::new(),
    )
    .await
    .expect("openrouter completion");

    assert!(!result.is_empty(), "expected some response, got empty");
}
