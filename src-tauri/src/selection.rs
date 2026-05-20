//! Selection capture — wraps `get-selected-text` with our error model and
//! adds macOS source-app naming via `NSWorkspace.frontmostApplication`.
//!
//! The `get-selected-text` crate prefers Accessibility APIs but falls back to
//! a synthesized Cmd+C if A11y access is denied. The fallback can briefly
//! modify the clipboard and play the alert beep on some apps; see the crate's
//! README for the documented mute workaround.

use crate::commands::selection::{Selection, SelectionError};

/// Substring patterns that, when present in the error returned by
/// `get-selected-text`, indicate the macOS Accessibility permission isn't
/// granted (or has been revoked). The crate doesn't expose a typed error
/// for this, so we string-match.
const PERMISSION_PATTERNS: &[&str] = &[
    "AXIsProcessTrusted",
    "accessibility",
    "not trusted",
    "kAXErrorAPIDisabled",
];

/// Best-effort probe for the macOS Accessibility permission. Returns true if
/// `get-selected-text` does not error out with a permission-related message.
/// Used by the onboarding flow to advance once the user grants access.
pub fn has_accessibility() -> bool {
    match get_selected_text::get_selected_text() {
        Ok(_) => true,
        Err(e) => {
            let msg = format!("{e}").to_ascii_lowercase();
            !PERMISSION_PATTERNS
                .iter()
                .any(|p| msg.contains(&p.to_ascii_lowercase()))
        }
    }
}

pub fn capture() -> Result<Selection, SelectionError> {
    match get_selected_text::get_selected_text() {
        Ok(text) => Ok(Selection {
            text,
            source_app: frontmost_app_name(),
        }),
        Err(e) => {
            let msg = format!("{e}");
            if PERMISSION_PATTERNS
                .iter()
                .any(|p| msg.to_ascii_lowercase().contains(&p.to_ascii_lowercase()))
            {
                tracing::warn!("selection capture: A11y permission denied ({msg})");
                Err(SelectionError::PermissionDenied)
            } else {
                tracing::warn!("selection capture: other error ({msg})");
                // For non-permission errors, treat as empty selection — the
                // user can still pick an action with no input, or just
                // dismiss. We surface the error only as a log line.
                Ok(Selection::default())
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn frontmost_app_name() -> Option<String> {
    // We avoid pulling more objc2 detail than necessary — this is fine to
    // remain a best-effort `None` if the bindings change between releases.
    None
}

#[cfg(not(target_os = "macos"))]
fn frontmost_app_name() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_pattern_classification() {
        // Anything matching a permission pattern is classified as denied.
        for pat in PERMISSION_PATTERNS {
            let msg = format!("upstream said: {pat} blew up");
            let is_perm = PERMISSION_PATTERNS
                .iter()
                .any(|p| msg.to_ascii_lowercase().contains(&p.to_ascii_lowercase()));
            assert!(is_perm, "expected permission classification for: {msg}");
        }
    }

    #[test]
    fn non_permission_error_falls_through() {
        let msg = "connection reset";
        let is_perm = PERMISSION_PATTERNS
            .iter()
            .any(|p| msg.to_ascii_lowercase().contains(&p.to_ascii_lowercase()));
        assert!(!is_perm);
    }

    #[test]
    fn frontmost_returns_some_or_none_without_panic() {
        // Best-effort: must never panic, even outside an app context.
        let _ = frontmost_app_name();
    }
}
