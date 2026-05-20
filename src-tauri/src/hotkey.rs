//! Global hotkey registration.
//!
//! Default: `Cmd+Shift+Space` on macOS, `Ctrl+Shift+Space` on Windows.
//! Configurable via the settings store; reregistered live in M5.

use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::commands::selection::SelectionError;
use crate::state::AppState;

/// The default global shortcut for v1.
pub const DEFAULT_SHORTCUT: &str = "CommandOrControl+Shift+Space";

const PANEL_LABEL: &str = "panel";

fn default_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

/// Register the default global shortcut. Returns `tauri::Result` so `setup()`
/// can `?`-propagate; the plugin's own error type is mapped to a Tauri error.
pub fn register_default(app: &App) -> tauri::Result<()> {
    let shortcut = default_shortcut();
    let handle = app.handle().clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            on_hotkey(handle.clone());
        })
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("global shortcut: {e}")))?;

    tracing::info!("registered global shortcut: {DEFAULT_SHORTCUT}");
    Ok(())
}

fn on_hotkey(app: AppHandle) {
    // Toggle: if panel is visible, hide and return. Otherwise capture
    // selection (off the UI thread), then show the panel.
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

    // Selection capture and event emission run on the async runtime so the
    // hotkey callback returns promptly. `get-selected-text` itself is
    // synchronous and may take 5–50ms, which we don't want to do on the
    // global-shortcut dispatcher.
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
    });
}

/// Re-register the global shortcut. Implemented in M5 (settings rebind).
pub fn reregister(_app: &AppHandle, _shortcut: &str) -> tauri::Result<()> {
    Err(tauri::Error::Anyhow(anyhow::anyhow!(
        "hotkey::reregister: implemented in M5"
    )))
}
