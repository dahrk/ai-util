//! Windows platform implementation — stubs.
//!
//! Filling in the four files in this directory is the only work required to
//! ship Windows support. No call-site changes needed anywhere else.

mod chrome;
mod cursor;
mod paster;

/// Marker type that carries all three platform impls.
#[derive(Clone, Copy, Debug, Default)]
pub struct PlatformImpl;
