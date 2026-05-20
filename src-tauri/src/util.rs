//! Tiny shared helpers used across the backend.

use std::time::{SystemTime, UNIX_EPOCH};

/// Milliseconds since the Unix epoch. Used in telemetry events.
pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// The Tauri window label of the floating panel — declared in `tauri.conf.json`.
pub const PANEL_LABEL: &str = "panel";
