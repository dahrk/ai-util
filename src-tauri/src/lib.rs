//! AI Text Actions — Tauri app setup.

mod commands;
mod hotkey;
mod llm;
mod platform;
mod selection;
mod settings;
mod state;
mod util;
mod window;

#[doc(hidden)]
pub mod __test_support {
    pub use crate::llm::gateway::{run_completion, switch_sink, token_sink, TokenSink};
    pub use crate::llm::prompts::{build_messages, Action};
    pub use crate::llm::providers::{Provider, ProviderConfig};

    pub fn init_client_for_tests() {
        crate::llm::gateway::__init_client_for_tests();
    }
}

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};
use tracing_subscriber::{fmt, EnvFilter};

use crate::platform::chrome::WindowChrome;
use crate::platform::PLATFORM;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    tracing::info!("starting ai-text-actions");

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState::default());

            if let Some(window) = app.get_webview_window("panel") {
                PLATFORM.convert_to_panel(&window)?;
                PLATFORM.apply_vibrancy(&window)?;
            } else {
                tracing::warn!("panel window not found in setup()");
            }

            hotkey::register_default(app)?;
            llm::gateway::init_client(&app.handle().clone());
            build_tray(&app.handle().clone())?;

            // If onboarding hasn't been completed, show the onboarding window
            // on launch instead of sitting silently in the background.
            let app_for_onboarding = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match crate::settings::load(&app_for_onboarding).await {
                    Ok(settings) if !settings.onboarding_complete => {
                        if let Some(win) = app_for_onboarding.get_webview_window("onboarding") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::hide_panel,
            commands::window::show_panel,
            commands::selection::get_selection,
            commands::completion::run_completion,
            commands::completion::cancel_completion,
            commands::selection::paste_back,
            commands::settings::get_settings,
            commands::settings::set_api_key,
            commands::settings::set_hotkey,
            commands::settings::set_model,
            commands::settings::set_prompt_override,
            commands::settings::set_enabled_actions,
            commands::settings::complete_onboarding,
            commands::settings::validate_api_key,
            commands::settings::probe_accessibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ai-text-actions");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, Some("Cmd+Q"))?;
    let menu = Menu::with_items(app, &[&settings_item, &quit_item])?;

    let app_for_event = app.clone();
    let _tray = TrayIconBuilder::with_id("main")
        .icon(
            app.default_window_icon()
                .cloned()
                .ok_or_else(|| tauri::Error::Anyhow(anyhow::anyhow!("no default window icon")))?,
        )
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |_app, event| match event.id.as_ref() {
            "settings" => {
                if let Some(win) = app_for_event.get_webview_window("settings") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app_for_event.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn init_logging() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).with_target(false).init();
}
