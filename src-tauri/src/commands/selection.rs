//! `get_selection` — capture currently selected text from the focused app.
//! `paste_back` — hide panel, write result to clipboard, synthesize Cmd+V.

use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::util::PANEL_LABEL;

#[derive(Serialize, Debug, Clone, Default)]
pub struct Selection {
    pub text: String,
    pub source_app: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum SelectionError {
    PermissionDenied,
    Other { message: String },
}

#[tauri::command]
pub async fn get_selection() -> Result<Selection, SelectionError> {
    crate::selection::capture()
}

/// Paste-back: hide the panel, write `text` to the clipboard, synthesize the
/// platform paste keystroke, restore the previous clipboard contents.
///
/// Failures on the *restore* step are logged and swallowed — by that point
/// the user already has their result pasted, and surfacing the error would
/// be more annoying than useful. Failures on the *paste itself* are
/// propagated so the frontend can fall back to "Copy to clipboard" guidance.
#[tauri::command]
pub async fn paste_back(app: AppHandle, text: String) -> Result<(), String> {
    use crate::platform::paster::Paster;
    use crate::platform::PLATFORM;

    // 1. Hide the panel so focus returns to the source app. Only sleep
    //    when the panel actually was visible — otherwise the 40ms is a
    //    pure tax (e.g., if a future caller invokes paste_back without
    //    showing the panel first).
    let panel_was_visible = app
        .get_webview_window(PANEL_LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(true);

    if panel_was_visible {
        if let Err(e) = crate::window::panel::hide_panel(&app) {
            tracing::warn!("paste_back: hide_panel failed: {e}");
        }
        // Settle delay: macOS needs a tick to transfer focus back to the
        // source app before our synthesized Cmd+V is delivered to it.
        tokio::time::sleep(Duration::from_millis(40)).await;
    }

    let clipboard = app.clipboard();
    let previous = clipboard.read_text().ok();

    clipboard
        .write_text(text.clone())
        .map_err(|e| format!("clipboard write: {e}"))?;

    // The paste itself runs on a blocking thread — enigo's sleeps are sync.
    let paste_result = tokio::task::spawn_blocking(move || PLATFORM.synthesize_paste()).await;

    // Restore previous clipboard, log-don't-fail on error.
    if let Some(prev) = previous {
        if let Err(e) = clipboard.write_text(prev) {
            tracing::warn!("paste_back: clipboard restore failed (non-fatal): {e}");
        }
    }

    match paste_result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(format!("paste keystroke: {e}")),
        Err(e) => Err(format!("paste task: {e}")),
    }
}
