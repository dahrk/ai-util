//! Synthesized paste-keystroke trait.
//!
//! The caller is responsible for putting the desired text on the clipboard
//! before invoking; this trait only fires the paste hotkey.

pub trait Paster {
    /// Synthesize the platform-native paste shortcut. Includes the small
    /// pre/post sleeps recommended for reliable clipboard handoff.
    fn synthesize_paste(&self) -> anyhow::Result<()>;
}
