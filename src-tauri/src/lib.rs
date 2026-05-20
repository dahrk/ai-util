//! AI Text Actions — Tauri app setup.
//!
//! Wires plugins, sets up logging, installs the platform window chrome
//! (NSPanel on macOS), registers the global hotkey, and exposes the IPC
//! command surface. See `CLAUDE.md` for the milestone status.

mod commands;
mod hotkey;
mod llm;
mod platform;
mod selection;
mod settings;
mod state;
mod window;

/// Re-exports for the integration test suite (`tests/live_providers.rs`).
/// Not part of the public app surface; keep this module thin.
#[doc(hidden)]
pub mod __test_support {
    pub use crate::llm::gateway::{
        client, init_client, run_completion, switch_sink, token_sink, TokenSink,
    };
    pub use crate::llm::prompts::{build_messages, Action};
    pub use crate::llm::providers::{Provider, ProviderConfig};

    /// Initialize the global HTTP client (idempotent). Integration tests must
    /// call this before invoking `run_completion`.
    pub fn init_client_for_tests() {
        // `init_client` reads no app state, but takes an `AppHandle` for the
        // production signature. The integration tests don't have one, so use
        // a direct initializer that bypasses the wrapper.
        use once_cell::sync::OnceCell;
        use reqwest::Client;
        use std::time::Duration;

        static SHIM: OnceCell<()> = OnceCell::new();
        SHIM.get_or_init(|| {
            // Try the public init via a do-nothing AppHandle, fallback to direct
            // builder. In practice for tests, `client()` calls `unwrap()` so we
            // need *some* successful initialization; the gateway's static is
            // `pub(crate)` so we initialize through the helper that *does* exist.
            let _ = Client::builder()
                .connect_timeout(Duration::from_secs(10))
                .pool_idle_timeout(None)
                .build()
                .expect("client");
        });
        // Direct entry point lives in gateway.rs.
        crate::llm::gateway::__init_client_for_tests();
    }
}

use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

use crate::platform::chrome::WindowChrome;
use crate::platform::PLATFORM;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

    tracing::info!("starting ai-text-actions");

    tauri::Builder::default()
        // ── Plugins ─────────────────────────────────────────────
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        // ── Setup ───────────────────────────────────────────────
        .setup(|app| {
            // Shared app state goes in first so handlers can read it on first invoke.
            app.manage(AppState::default());

            // Convert the panel window into a native floating panel. Must run
            // after the window exists but before it's first shown.
            if let Some(window) = app.get_webview_window("panel") {
                PLATFORM.convert_to_panel(&window)?;
                PLATFORM.apply_vibrancy(&window)?;
            } else {
                tracing::warn!("panel window not found in setup() — check tauri.conf.json");
            }

            // Register the default global hotkey (Cmd+Shift+Space).
            hotkey::register_default(app)?;

            // Pre-warm the shared HTTP client for the LLM gateway.
            llm::gateway::init_client(&app.handle().clone());

            Ok(())
        })
        // ── Tauri commands ──────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // M1
            commands::window::hide_panel,
            commands::window::show_panel,
            // M2
            commands::selection::get_selection,
            // M3
            commands::completion::run_completion,
            commands::completion::cancel_completion,
            // M4
            commands::selection::paste_back,
            // M3 / M5
            commands::settings::get_settings,
            commands::settings::set_api_key,
            commands::settings::set_hotkey,
            commands::settings::set_model,
            commands::settings::complete_onboarding,
            commands::settings::validate_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ai-text-actions");
}

fn init_logging() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).with_target(false).init();
}
