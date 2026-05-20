//! macOS platform implementation.
//!
//! Splits into three sibling files matching the three traits. The
//! `PlatformImpl` unit struct is the single concrete type exported.

mod chrome;
mod cursor;
mod paster;

/// Marker type that carries all three platform impls.
#[derive(Clone, Copy, Debug, Default)]
pub struct PlatformImpl;
