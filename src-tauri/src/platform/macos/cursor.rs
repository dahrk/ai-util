//! Cursor position via `NSEvent::mouseLocation`.
//!
//! **Coordinate-system note:** AppKit reports the cursor in Cocoa coordinates
//! (origin bottom-left of the primary screen). We convert to the top-left-origin
//! coordinate system Tauri uses by flipping `y` against the primary screen height.

use objc::runtime::Object;
use objc::{class, msg_send, sel, sel_impl};

use crate::platform::cursor::CursorPos;
use crate::platform::macos::PlatformImpl;

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct CgPoint {
    x: f64,
    y: f64,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct CgSize {
    width: f64,
    height: f64,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct CgRect {
    origin: CgPoint,
    size: CgSize,
}

impl CursorPos for PlatformImpl {
    fn current(&self) -> Option<(i32, i32)> {
        unsafe {
            // NSEvent::mouseLocation is a class method returning NSPoint (CGPoint on x86_64/aarch64).
            let cursor: CgPoint = msg_send![class!(NSEvent), mouseLocation];

            // Read primary screen height for y-flip.
            let screens: *mut Object = msg_send![class!(NSScreen), screens];
            if screens.is_null() {
                return None;
            }
            let count: usize = msg_send![screens, count];
            if count == 0 {
                return None;
            }
            let primary: *mut Object = msg_send![screens, objectAtIndex: 0usize];
            if primary.is_null() {
                return None;
            }
            let frame: CgRect = msg_send![primary, frame];

            Some((cursor.x as i32, (frame.size.height - cursor.y) as i32))
        }
    }
}
