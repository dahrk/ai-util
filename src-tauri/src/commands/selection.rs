//! Phase 2: get_selection — capture currently selected text from the focused app.
//! Phase 6: paste_back — hide panel, write result to clipboard, synthesize Cmd+V.
//!
//! Both use the `get-selected-text` crate's hybrid A11y / clipboard strategy.

use serde::Serialize;

#[derive(Serialize)]
pub struct Selection {
    pub text: String,
    pub source_app: Option<String>,
}

#[tauri::command]
pub async fn get_selection() -> Result<Selection, String> {
    // TODO Phase 2:
    //   - call get_selected_text::get_selected_text()
    //   - on error, return empty Selection rather than erroring
    //   - capture source app name (focused process) when available
    todo!("Phase 2")
}

#[tauri::command]
pub async fn paste_back(_text: String) -> Result<(), String> {
    // TODO Phase 6:
    //   - hide panel first (so focus returns to source app)
    //   - save current clipboard
    //   - write `text` to clipboard
    //   - sleep 30ms
    //   - synthesize Cmd+V / Ctrl+V via crate::input
    //   - sleep 150ms
    //   - restore original clipboard
    todo!("Phase 6")
}
