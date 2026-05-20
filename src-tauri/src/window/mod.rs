//! Floating panel window management.
//! See `IMPLEMENTATION_PLAN.md` § Phase 1 and § Phase 10 (panel positioning).
//!
//! Platform-specific window chrome lives under `crate::platform::*`; this
//! module is platform-agnostic.

pub mod panel;
