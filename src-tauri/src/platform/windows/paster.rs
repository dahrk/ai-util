//! Windows Paster stub.
//!
//! TODO Phase X-Windows:
//!   - mirror the macOS impl with `{+CTRL}v{-CTRL}` via enigo
//!   - keep the pre/post sleeps

use crate::platform::paster::Paster;
use crate::platform::windows::PlatformImpl;

impl Paster for PlatformImpl {
    fn synthesize_paste(&self) -> anyhow::Result<()> {
        unimplemented!("Paster::synthesize_paste on Windows — fill in {{+CTRL}}v{{-CTRL}}")
    }
}
