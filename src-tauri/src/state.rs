//! Shared application state stored on the Tauri AppHandle.
//!
//! Access via `app.state::<AppState>()`.

use parking_lot::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct AppState {
    /// Most recent captured selection. Populated by the hotkey handler in M2.
    pub last_selection: Mutex<Option<String>>,

    /// In-flight completion's cancel token. Replaced on every new run; cleared
    /// on done/error/cancel.
    pub cancel_token: Mutex<Option<CancellationToken>>,
}
