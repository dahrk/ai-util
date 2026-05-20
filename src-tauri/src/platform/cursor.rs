//! Cursor-position trait: physical screen coordinates of the mouse pointer.

pub trait CursorPos {
    /// Returns the current cursor position in physical pixels, or `None` if
    /// it can't be determined.
    fn current(&self) -> Option<(i32, i32)>;
}
