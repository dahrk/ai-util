//! macOS paste-back via `enigo` (Cmd+V) with the recommended sleeps.
//!
//! Full implementation lands in M4. M1 ships the shell so `commands::selection::paste_back`
//! can be wired up against a stable trait signature.

use std::thread::sleep;
use std::time::Duration;

use crate::platform::macos::PlatformImpl;
use crate::platform::paster::Paster;

impl Paster for PlatformImpl {
    fn synthesize_paste(&self) -> anyhow::Result<()> {
        // Pre-sleep: let the OS register a clipboard write that the caller just did.
        sleep(Duration::from_millis(30));

        #[cfg(feature = "paste-enabled")]
        {
            use enigo::{Enigo, Keyboard, Settings};
            let mut enigo = Enigo::new(&Settings::default())
                .map_err(|e| anyhow::anyhow!("enigo init failed: {e:?}"))?;
            enigo
                .key_sequence_parse("{+CMD}v{-CMD}")
                .map_err(|e| anyhow::anyhow!("enigo key sequence failed: {e:?}"))?;
        }
        // M4 will flip the gate by enabling enigo unconditionally. The cfg gate keeps
        // the unimplemented body from accidentally firing during M1–M3 tests.
        #[cfg(not(feature = "paste-enabled"))]
        {
            tracing::warn!("synthesize_paste called but paste-enabled feature is off (M1-M3 stub)");
        }

        // Post-sleep: give the paste a moment before the caller restores the clipboard.
        sleep(Duration::from_millis(150));
        Ok(())
    }
}
