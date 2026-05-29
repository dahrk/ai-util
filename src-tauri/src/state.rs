//! Shared application state stored on the Tauri AppHandle.
//!
//! Access via `app.state::<AppState>()`.

use std::sync::atomic::AtomicU64;

use parking_lot::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct AppState {
    /// Most recent captured selection, populated by the hotkey handler.
    pub last_selection: Mutex<Option<String>>,

    /// In-flight completion's `(generation, cancel token)`. Replaced on every
    /// new run; cleared on done/error/cancel. The generation lets a finishing
    /// task tell whether it still owns the slot: a superseded run must NOT
    /// clear a newer run's token, or that newer run becomes un-cancellable.
    pub cancel_token: Mutex<Option<(u64, CancellationToken)>>,

    /// Monotonic id handed out per completion to stamp the slot above.
    pub completion_gen: AtomicU64,
}
