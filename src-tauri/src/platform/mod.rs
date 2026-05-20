//! Platform abstraction.
//!
//! All OS-specific code lives under this module. Three traits are defined in
//! `chrome`, `paster`, and `cursor`; per-OS impls live in `macos/` and
//! `windows/`. Call sites use [`PLATFORM`], never `#[cfg(target_os)]`.
//!
//! Adding Windows = fill in the three files under `platform/windows/`; no
//! other changes anywhere in the tree.

pub mod chrome;
pub mod cursor;
pub mod paster;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::PlatformImpl;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::PlatformImpl;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
compile_error!("Unsupported platform: AI Text Actions supports macOS and (stubbed) Windows only.");

pub const PLATFORM: PlatformImpl = PlatformImpl;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::chrome::WindowChrome;
    use crate::platform::cursor::CursorPos;
    use crate::platform::paster::Paster;

    /// Compile-time guard: `PLATFORM` implements all three traits with the
    /// expected signatures. If any signature drifts, this test fails to
    /// compile — that's the point.
    #[test]
    fn platform_implements_all_traits() {
        fn assert_impls<T: WindowChrome + Paster + CursorPos>(_: &T) {}
        assert_impls(&PLATFORM);
    }
}
