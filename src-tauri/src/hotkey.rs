//! Global hotkey registration.
//!
//! Default: `Cmd+Shift+Space` on macOS, `Ctrl+Shift+Space` on Windows.
//! Configurable via the settings store; reregistered live in M5.

use tauri::{App, AppHandle};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// The default global shortcut for v1.
pub const DEFAULT_SHORTCUT: &str = "CommandOrControl+Shift+Space";

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
            if let Err(e) = on_hotkey(&handle) {
                tracing::warn!("hotkey handler error: {e}");
            }
        })
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("global shortcut: {e}")))?;

    tracing::info!("registered global shortcut: {DEFAULT_SHORTCUT}");
    Ok(())
}

fn on_hotkey(app: &AppHandle) -> tauri::Result<()> {
    // M1: simple toggle. M2 will spawn selection capture before show.
    crate::window::panel::toggle_panel(app)
}

/// Re-register the global shortcut. Implemented in M5 (settings rebind).
pub fn reregister(_app: &AppHandle, _shortcut: &str) -> tauri::Result<()> {
    // M5 implementation:
    //   - parse the shortcut string with Shortcut::from_str (tauri-plugin-global-shortcut)
    //   - app.global_shortcut().unregister_all()
    //   - app.global_shortcut().on_shortcut(new_shortcut, |...|)
    Err(tauri::Error::AssetNotFound(
        "hotkey::reregister: implemented in M5".into(),
    ))
}
