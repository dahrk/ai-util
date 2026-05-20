//! Window-control commands callable from the frontend.
//!
//! Tiny wrappers — Esc/blur dismiss in the panel calls these via `invoke()`.

use tauri::AppHandle;

#[tauri::command]
pub async fn hide_panel(app: AppHandle) -> Result<(), String> {
    crate::window::panel::hide_panel(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn show_panel(app: AppHandle) -> Result<(), String> {
    crate::window::panel::show_panel(&app).map_err(|e| e.to_string())
}
