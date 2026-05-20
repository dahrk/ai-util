//! M2: `get_selection` — capture currently selected text from the focused app.
//! M4: `paste_back` — hide panel, write result to clipboard, synthesize Cmd+V.

use serde::Serialize;

#[derive(Serialize, Debug, Clone, Default)]
pub struct Selection {
    pub text: String,
    pub source_app: Option<String>,
}

/// Errors that the frontend can act on. We don't return `Err` for empty
/// selections (that's a valid state); only return `Err` when something the
/// user should fix happened (e.g. A11y permission revoked).
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

#[tauri::command]
pub async fn paste_back(_text: String) -> Result<(), String> {
    // M4: implementation.
    //   1. crate::window::panel::hide_panel(&app)
    //   2. save clipboard via tauri-plugin-clipboard-manager
    //   3. write `text` to clipboard
    //   4. crate::platform::PLATFORM.synthesize_paste()
    //   5. restore clipboard (log-don't-fail on error)
    Err("paste_back: implemented in M4".into())
}
