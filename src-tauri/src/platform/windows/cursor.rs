//! Windows CursorPos stub.
//!
//! TODO Phase X-Windows:
//!   - use Win32 `GetCursorPos` (windows-rs or `winapi`)
//!   - translate device-pixel coords if running on a high-DPI monitor

use crate::platform::cursor::CursorPos;
use crate::platform::windows::PlatformImpl;

impl CursorPos for PlatformImpl {
    fn current(&self) -> Option<(i32, i32)> {
        unimplemented!("CursorPos::current on Windows — call GetCursorPos via windows-rs")
    }
}
