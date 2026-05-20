//! Window-chrome trait: native window styling that Tauri doesn't expose directly.
//!
//! On macOS this swaps the underlying NSWindow for an NSPanel (non-activating,
//! floats above fullscreen, doesn't appear in Cmd-Tab). On Windows this would
//! apply Mica/Acrylic and toolwindow flags.

use tauri::WebviewWindow;

pub trait WindowChrome {
    /// Convert the given window into a native floating panel. Must be called
    /// after the window exists but before its first `show()`.
    fn convert_to_panel(&self, window: &WebviewWindow) -> tauri::Result<()>;

    /// Apply background vibrancy / blur. No-op on platforms without it.
    /// Implementations may be no-ops until M6.
    fn apply_vibrancy(&self, window: &WebviewWindow) -> tauri::Result<()>;
}
