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
    pub use crate::llm::provider_impl::{provider_for, ModelInfo, ProviderError, ProviderImpl};
    pub use crate::llm::providers::{Provider, ProviderConfig};

    pub fn init_client_for_tests() {
        crate::llm::gateway::__init_client_for_tests();
    }
}

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};
use tracing_subscriber::{fmt, EnvFilter};

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

            // FIXME(macos-26): NSPanel conversion + vibrancy are disabled.
            // Both `convert_to_panel` (raw `setClass: NSPanel` + style/level
            // bit-bashing via `msg_send!`) and `apply_vibrancy` throw an
            // NSException at `applicationDidFinishLaunching:` time in the
            // hardened-runtime packaged build on macOS 26.2. The exception
            // unwinds through tao's extern "C" delegate callback and trips
            // `panic_cannot_unwind`, aborting the process. Dev builds skip
            // the hardened runtime so they're unaffected.
            //
            // Consequence: the panel behaves like a normal window — it steals
            // focus on show and won't float over fullscreen apps. We accept
            // that until we either (a) replace the isa-swizzling approach
            // with a real NSPanel subclass via `objc2`, or (b) confirm which
            // of the two calls is the actual culprit and re-enable the other.
            // See `platform/macos/chrome.rs`.
            if app.get_webview_window("panel").is_none() {
                tracing::warn!("panel window not found in setup()");
            }

            hotkey::register_default(app)?;
            llm::gateway::init_client(&app.handle().clone());
            build_tray(&app.handle().clone())?;
            build_app_menu(&app.handle().clone())?;

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
            commands::settings::set_dev_panel_persistent,
            commands::settings::set_model,
            commands::settings::set_prompt_override,
            commands::settings::set_enabled_actions,
            commands::settings::complete_onboarding,
            commands::settings::validate_api_key,
            commands::settings::probe_accessibility,
            commands::models::fetch_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ai-text-actions");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    #[cfg(debug_assertions)]
    let playground_item = MenuItem::with_id(app, "playground", "Playground…", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, Some("Cmd+Q"))?;

    #[cfg(debug_assertions)]
    let menu = Menu::with_items(app, &[&settings_item, &playground_item, &quit_item])?;
    #[cfg(not(debug_assertions))]
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
            "settings" => open_settings(&app_for_event),
            #[cfg(debug_assertions)]
            "playground" => open_playground(&app_for_event),
            "quit" => app_for_event.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn open_settings(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg(debug_assertions)]
fn open_playground(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("playground") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// macOS app menu — gives Cmd+, → Settings discoverability alongside the
/// tray. On macOS the first submenu's title is replaced by the bundle name,
/// so the "AI Text Actions" string here is cosmetic.
fn build_app_menu(app: &AppHandle) -> tauri::Result<()> {
    let about = PredefinedMenuItem::about(
        app,
        Some("About AI Text Actions"),
        Some(AboutMetadata::default()),
    )?;
    let settings_item =
        MenuItem::with_id(app, "app_settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let services = PredefinedMenuItem::services(app, None)?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let sep4 = PredefinedMenuItem::separator(app)?;

    let app_submenu = Submenu::with_items(
        app,
        "AI Text Actions",
        true,
        &[
            &about,
            &sep1,
            &settings_item,
            &sep2,
            &services,
            &sep3,
            &hide,
            &hide_others,
            &show_all,
            &sep4,
            &quit,
        ],
    )?;

    let menu = Menu::with_items(app, &[&app_submenu])?;
    app.set_menu(menu)?;

    let app_for_event = app.clone();
    app.on_menu_event(move |_app, event| {
        if event.id().as_ref() == "app_settings" {
            open_settings(&app_for_event);
        }
    });

    Ok(())
}

fn init_logging() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).with_target(false).init();
}
