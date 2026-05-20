//! Show/hide the floating panel and position it near the cursor.
//!
//! Two pure free functions — `clamp_to_monitor` and `compute_position` — are
//! extracted from the show path so that positioning logic can be unit-tested
//! without spinning up a Tauri runtime.

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

use crate::platform::cursor::CursorPos;
use crate::platform::PLATFORM;

const PANEL_LABEL: &str = "panel";

/// Default mouse-to-panel offset (the panel's top-left appears slightly
/// below and to the right of the cursor so the cursor stays visible).
const CURSOR_OFFSET_X: i32 = 8;
const CURSOR_OFFSET_Y: i32 = 12;

/// Clamp a panel placement to a monitor's bounds. Last-resort guard that
/// `compute_position` falls back to after attempting edge-flip.
pub fn clamp_to_monitor(
    pos: (i32, i32),
    monitor_size: (i32, i32),
    panel_size: (i32, i32),
) -> (i32, i32) {
    let (x, y) = pos;
    let (mw, mh) = monitor_size;
    let (pw, ph) = panel_size;
    let max_x = (mw - pw).max(0);
    let max_y = (mh - ph).max(0);
    (x.clamp(0, max_x), y.clamp(0, max_y))
}

/// Compute the on-screen position for the panel given a cursor position.
///
/// **Edge-flip**: if anchoring to the lower-right of the cursor would push
/// the panel off-screen, anchor to the opposite side instead. This keeps the
/// panel fully visible without resorting to a hard clamp that would visually
/// "stick" to the monitor edge.
pub fn compute_position(
    cursor: (i32, i32),
    monitor_size: (i32, i32),
    panel_size: (i32, i32),
) -> PhysicalPosition<i32> {
    let (cx, cy) = cursor;
    let (mw, mh) = monitor_size;
    let (pw, ph) = panel_size;

    let want_x = cx + CURSOR_OFFSET_X;
    let want_y = cy + CURSOR_OFFSET_Y;

    let flipped_x = if want_x + pw > mw {
        // Anchor to the left of the cursor.
        cx - pw - CURSOR_OFFSET_X
    } else {
        want_x
    };
    let flipped_y = if want_y + ph > mh {
        // Anchor above the cursor.
        cy - ph - CURSOR_OFFSET_Y
    } else {
        want_y
    };

    let (x, y) = clamp_to_monitor((flipped_x, flipped_y), monitor_size, panel_size);
    PhysicalPosition { x, y }
}

pub fn show_panel(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(PANEL_LABEL) else {
        tracing::warn!("panel window not found");
        return Ok(());
    };

    if let Some(cursor) = PLATFORM.current() {
        let monitor_size = window
            .current_monitor()?
            .map(|m| {
                let PhysicalSize { width, height } = *m.size();
                (width as i32, height as i32)
            })
            .unwrap_or((1920, 1080));

        let panel_size = window
            .outer_size()
            .map(|s| (s.width as i32, s.height as i32))
            .unwrap_or((380, 240));

        let pos = compute_position(cursor, monitor_size, panel_size);
        window.set_position(pos)?;
    }

    window.show()?;
    Ok(())
}

pub fn hide_panel(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(PANEL_LABEL) {
        window.hide()?;
    }
    Ok(())
}

pub fn toggle_panel(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(PANEL_LABEL) else {
        return Ok(());
    };
    if window.is_visible()? {
        window.hide()?;
    } else {
        show_panel(app)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const MON: (i32, i32) = (1920, 1080);
    const PANEL: (i32, i32) = (380, 240);

    #[test]
    fn clamp_keeps_interior_positions_unchanged() {
        assert_eq!(clamp_to_monitor((500, 400), MON, PANEL), (500, 400));
    }

    #[test]
    fn clamp_pushes_past_right_edge_inwards() {
        // x would overflow: 1900 + 380 > 1920 → clamp to 1920 - 380 = 1540.
        assert_eq!(clamp_to_monitor((1900, 400), MON, PANEL), (1540, 400));
    }

    #[test]
    fn clamp_pushes_past_bottom_edge_inwards() {
        assert_eq!(clamp_to_monitor((500, 1000), MON, PANEL), (500, 840));
    }

    #[test]
    fn clamp_pushes_past_top_left_inwards() {
        assert_eq!(clamp_to_monitor((-50, -100), MON, PANEL), (0, 0));
    }

    #[test]
    fn clamp_handles_panel_larger_than_monitor() {
        // Defensive: panel wider than monitor → clamp to 0, never negative.
        assert_eq!(clamp_to_monitor((100, 100), (300, 200), PANEL), (0, 0));
    }

    #[test]
    fn compute_offsets_from_cursor_in_interior() {
        let p = compute_position((100, 100), MON, PANEL);
        assert_eq!((p.x, p.y), (100 + CURSOR_OFFSET_X, 100 + CURSOR_OFFSET_Y));
    }

    #[test]
    fn compute_flips_to_left_near_right_edge() {
        // Cursor is at x=1900 — anchoring on the right would overflow.
        // Expected: flip to left of cursor → x = 1900 - 380 - 8 = 1512.
        let p = compute_position((1900, 300), MON, PANEL);
        assert_eq!(p.x, 1900 - PANEL.0 - CURSOR_OFFSET_X);
        // y is in the interior, no flip.
        assert_eq!(p.y, 300 + CURSOR_OFFSET_Y);
    }

    #[test]
    fn compute_flips_above_near_bottom_edge() {
        // Cursor at y=1050 — anchoring below would overflow.
        let p = compute_position((300, 1050), MON, PANEL);
        assert_eq!(p.y, 1050 - PANEL.1 - CURSOR_OFFSET_Y);
        assert_eq!(p.x, 300 + CURSOR_OFFSET_X);
    }

    #[test]
    fn compute_flips_both_in_bottom_right_corner() {
        let p = compute_position((1900, 1050), MON, PANEL);
        assert_eq!(p.x, 1900 - PANEL.0 - CURSOR_OFFSET_X);
        assert_eq!(p.y, 1050 - PANEL.1 - CURSOR_OFFSET_Y);
    }

    #[test]
    fn compute_clamps_in_top_left_corner() {
        // Cursor at (0,0); a "flip" would push us to negative coords, but the
        // clamp guarantees we stay on-screen.
        let p = compute_position((0, 0), MON, PANEL);
        assert_eq!((p.x, p.y), (CURSOR_OFFSET_X, CURSOR_OFFSET_Y));
    }
}
