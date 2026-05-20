//! macOS paste-back via `enigo` (Cmd+V) with the recommended sleeps.

use std::thread::sleep;
use std::time::Duration;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};

use crate::platform::macos::PlatformImpl;
use crate::platform::paster::Paster;

const PRE_SLEEP: Duration = Duration::from_millis(30);
const POST_SLEEP: Duration = Duration::from_millis(150);

impl Paster for PlatformImpl {
    fn synthesize_paste(&self) -> anyhow::Result<()> {
        // Pre-sleep: let the OS register a clipboard write the caller just did.
        sleep(PRE_SLEEP);

        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| anyhow::anyhow!("enigo init failed: {e:?}"))?;

        enigo
            .key(Key::Meta, Direction::Press)
            .map_err(|e| anyhow::anyhow!("press Cmd: {e:?}"))?;
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| anyhow::anyhow!("click v: {e:?}"))?;
        enigo
            .key(Key::Meta, Direction::Release)
            .map_err(|e| anyhow::anyhow!("release Cmd: {e:?}"))?;

        // Post-sleep: give the paste a moment before the caller restores the clipboard.
        sleep(POST_SLEEP);
        Ok(())
    }
}
