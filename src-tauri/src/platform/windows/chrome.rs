//! Windows WindowChrome stub.
//!
//! TODO Phase X-Windows:
//!   - apply tool-window flags so the panel doesn't appear in the taskbar
//!   - set WS_EX_TOOLWINDOW + WS_EX_NOACTIVATE on the HWND
//!   - apply Mica via window-vibrancy `apply_mica(...)` (Win11) or `apply_acrylic`

use tauri::WebviewWindow;

use crate::platform::chrome::WindowChrome;
use crate::platform::windows::PlatformImpl;

impl WindowChrome for PlatformImpl {
    fn convert_to_panel(&self, _window: &WebviewWindow) -> tauri::Result<()> {
        unimplemented!(
            "WindowChrome::convert_to_panel on Windows — fill in platform/windows/chrome.rs"
        )
    }

    fn apply_vibrancy(&self, _window: &WebviewWindow) -> tauri::Result<()> {
        unimplemented!("WindowChrome::apply_vibrancy on Windows — use window-vibrancy::apply_mica")
    }
}
