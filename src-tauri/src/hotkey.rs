//! Global hotkey registration.
//!
//! Default: `Cmd+Shift+Space` on macOS, `Ctrl+Shift+Space` on Windows.
//! Configurable via the settings store; reregistered live in M5.

use std::str::FromStr;

use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::commands::selection::SelectionError;
use crate::state::AppState;

pub const DEFAULT_SHORTCUT: &str = "CommandOrControl+Shift+Space";

const PANEL_LABEL: &str = "panel";

fn default_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

/// Register the default global shortcut.
pub fn register_default(app: &App) -> tauri::Result<()> {
    register(app.handle(), default_shortcut())
}

/// Re-register the global shortcut to a new combo. Unregisters everything
/// first so we don't double-fire.
pub fn reregister(app: &AppHandle, shortcut: &str) -> tauri::Result<()> {
    let parsed = Shortcut::from_str(shortcut)
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("parse shortcut: {e}")))?;

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("unregister: {e}")))?;

    register(app, parsed)
}

fn register(app: &AppHandle, shortcut: Shortcut) -> tauri::Result<()> {
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            on_hotkey(handle.clone());
        })
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("global shortcut: {e}")))?;

    tracing::info!("registered global shortcut: {shortcut:?}");
    Ok(())
}

fn on_hotkey(app: AppHandle) {
    let _ = app.emit_to(PANEL_LABEL, "telemetry_hotkey_received", now_ms());

    if let Some(window) = app.get_webview_window(PANEL_LABEL) {
        match window.is_visible() {
            Ok(true) => {
                if let Err(e) = crate::window::panel::hide_panel(&app) {
                    tracing::warn!("hide_panel failed: {e}");
                }
                return;
            }
            Ok(false) => {}
            Err(e) => tracing::warn!("is_visible failed, assuming hidden: {e}"),
        }
    }

    tauri::async_runtime::spawn(async move {
        let result = tokio::task::spawn_blocking(crate::selection::capture).await;
        match result {
            Ok(Ok(selection)) => {
                {
                    let state = app.state::<AppState>();
                    let mut slot = state.last_selection.lock();
                    *slot = Some(selection.text.clone());
                }
                if let Err(e) = app.emit_to(PANEL_LABEL, "selection_captured", &selection) {
                    tracing::warn!("emit selection_captured failed: {e}");
                }
            }
            Ok(Err(SelectionError::PermissionDenied)) => {
                if let Err(e) = app.emit_to(PANEL_LABEL, "permission_required", &()) {
                    tracing::warn!("emit permission_required failed: {e}");
                }
            }
            Ok(Err(SelectionError::Other { message })) => {
                tracing::warn!("selection capture failed: {message}");
            }
            Err(join_err) => {
                tracing::warn!("selection capture task panicked: {join_err}");
            }
        }

        if let Err(e) = crate::window::panel::show_panel(&app) {
            tracing::warn!("show_panel failed: {e}");
        }
        let _ = app.emit_to(PANEL_LABEL, "telemetry_panel_visible", now_ms());
    });
}

fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
