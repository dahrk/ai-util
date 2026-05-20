//! NSPanel conversion + window-vibrancy on macOS.
//!
//! **The single most important platform detail for the "feels native" goal.**
//!
//! Without this conversion, Tauri's default `NSWindow` steals focus on show.
//! With it, the panel:
//!   - floats above fullscreen apps (collection behavior + Transient)
//!   - doesn't appear in Cmd-Tab or the Dock
//!   - doesn't become key/main on show — the underlying app keeps focus
//!
//! Must run AFTER the window is created but BEFORE its first `show()`.
//!
//! We work via the classic `objc` macros + raw bitmask integers rather than
//! the `cocoa` enums because (a) cocoa's enums are deprecated in favor of
//! objc2 and (b) `NSWindowStyleMaskNonactivatingPanel` (the bit we care
//! about) doesn't have a stable Rust-side constant in either crate.

use objc::runtime::Object;
use objc::{class, msg_send, sel, sel_impl};
use tauri::WebviewWindow;

use crate::platform::chrome::WindowChrome;
use crate::platform::macos::PlatformImpl;

// NSWindowStyleMask bits — values per AppKit headers.
// https://developer.apple.com/documentation/appkit/nswindowstylemask
const NS_STYLE_NONACTIVATING_PANEL: u64 = 1 << 7;
const NS_STYLE_FULL_SIZE_CONTENT_VIEW: u64 = 1 << 15;
const NS_STYLE_RESIZABLE: u64 = 1 << 3;

// NSWindowCollectionBehavior bits.
const NS_BEHAVIOR_CAN_JOIN_ALL_SPACES: u64 = 1 << 0;
const NS_BEHAVIOR_TRANSIENT: u64 = 1 << 3;
const NS_BEHAVIOR_FULL_SCREEN_AUXILIARY: u64 = 1 << 8;

// NSWindow levels — floating sits +3 above normal.
const NS_FLOATING_WINDOW_LEVEL: i64 = 3;

const BOOL_YES: bool = true;
const BOOL_NO: bool = false;

impl WindowChrome for PlatformImpl {
    fn convert_to_panel(&self, window: &WebviewWindow) -> tauri::Result<()> {
        let ns_window_ptr = window.ns_window()? as *mut Object;
        if ns_window_ptr.is_null() {
            tracing::warn!("ns_window() returned null; skipping NSPanel conversion");
            return Ok(());
        }

        unsafe {
            // 1. Swap class to NSPanel.
            let panel_class = class!(NSPanel);
            let _: () = msg_send![ns_window_ptr, setClass: panel_class];

            // 2. Style mask: non-activating utility panel.
            let style_mask: u64 =
                NS_STYLE_NONACTIVATING_PANEL | NS_STYLE_FULL_SIZE_CONTENT_VIEW | NS_STYLE_RESIZABLE;
            let _: () = msg_send![ns_window_ptr, setStyleMask: style_mask];

            // 3. Float above normal windows.
            let _: () = msg_send![ns_window_ptr, setLevel: NS_FLOATING_WINDOW_LEVEL];

            // 4. Collection behavior: join all spaces + float over fullscreen + transient.
            let collection: u64 = NS_BEHAVIOR_CAN_JOIN_ALL_SPACES
                | NS_BEHAVIOR_FULL_SCREEN_AUXILIARY
                | NS_BEHAVIOR_TRANSIENT;
            let _: () = msg_send![ns_window_ptr, setCollectionBehavior: collection];

            // 5. Don't become key/main unless explicitly needed — keeps source-app focus.
            let _: () = msg_send![ns_window_ptr, setBecomesKeyOnlyIfNeeded: BOOL_YES];
            let _: () = msg_send![ns_window_ptr, setHidesOnDeactivate: BOOL_NO];
            let _: () = msg_send![ns_window_ptr, setMovableByWindowBackground: BOOL_NO];
        }

        tracing::info!("converted panel window to NSPanel");
        Ok(())
    }

    fn apply_vibrancy(&self, _window: &WebviewWindow) -> tauri::Result<()> {
        // No-op until M6. The trait surface is locked now so call sites in
        // lib.rs's setup() don't have to be touched later.
        Ok(())
    }
}
