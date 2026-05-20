//! Action prompt templates.
//!
//! The "output ONLY" framing is doing real work — small fast models love to
//! preamble ("Sure! Here's your summary:") and that would end up pasted into
//! the user's document. Be strict.
//!
//! `build_messages_with_override` lets settings supply a user-message
//! template; `{text}` is interpolated. Empty/whitespace overrides fall back
//! to the built-in default so settings doesn't need to know the defaults.

use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Summarize,
    Edit,
    Elaborate,
    Research,
}

impl Action {
    pub const ALL: [Action; 4] = [
        Action::Summarize,
        Action::Edit,
        Action::Elaborate,
        Action::Research,
    ];

    /// Lowercase identifier matching the frontend's `Action` type and the
    /// settings store's prompts map key.
    pub fn as_key(&self) -> &'static str {
        match self {
            Action::Summarize => "summarize",
            Action::Edit => "edit",
            Action::Elaborate => "elaborate",
            Action::Research => "research",
        }
    }
}

impl FromStr for Action {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "summarize" => Ok(Action::Summarize),
            "edit" => Ok(Action::Edit),
            "elaborate" => Ok(Action::Elaborate),
            "research" => Ok(Action::Research),
            other => Err(format!("unknown action: {other}")),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct Message {
    pub role: String,
    pub content: String,
}

const SHARED_SYSTEM: &str =
    "You output ONLY the requested rewrite. No preamble, no quotes, no markdown unless the input had it.";

fn default_user_prompt(action: Action, text: &str) -> String {
    match action {
        Action::Summarize => format!("Summarize the following in 2–3 sentences:\n\n{text}"),
        Action::Edit => {
            format!("Rewrite for clarity and concision. Preserve meaning, voice, and any formatting.\n\n{text}")
        }
        Action::Elaborate => {
            format!("Expand the input with more detail, examples, and context. Match the original tone.\n\n{text}")
        }
        Action::Research => {
            format!(
                "Provide concise factual context for the input topic in 3–5 sentences.\n\n{text}"
            )
        }
    }
}

/// Build the chat messages with the default prompt for `action`.
pub fn build_messages(action: Action, text: &str) -> Vec<Message> {
    build_messages_with_override(action, text, None)
}

/// Build the chat messages, optionally substituting a user-supplied template
/// for the user message. The template can include `{text}` which is replaced
/// with the captured selection.
pub fn build_messages_with_override(
    action: Action,
    text: &str,
    user_override: Option<&str>,
) -> Vec<Message> {
    let user_content = match user_override {
        Some(template) if !template.trim().is_empty() => template.replace("{text}", text),
        _ => default_user_prompt(action, text),
    };

    vec![
        Message {
            role: "system".into(),
            content: SHARED_SYSTEM.into(),
        },
        Message {
            role: "user".into(),
            content: user_content,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_system_warns_against_preamble() {
        assert!(SHARED_SYSTEM.contains("output ONLY"));
    }

    #[test]
    fn build_messages_returns_system_then_user() {
        let msgs = build_messages(Action::Summarize, "hello");
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "system");
        assert_eq!(msgs[1].role, "user");
    }

    #[test]
    fn each_action_embeds_the_selection_text() {
        let needle = "marker-string-fc4e";
        for action in Action::ALL {
            let msgs = build_messages(action, needle);
            assert!(
                msgs[1].content.contains(needle),
                "action {action:?} dropped the selection"
            );
        }
    }

    #[test]
    fn override_substitutes_text_placeholder() {
        let msgs = build_messages_with_override(
            Action::Edit,
            "the cat",
            Some("Make it haiku-shaped: {text}"),
        );
        assert_eq!(msgs[1].content, "Make it haiku-shaped: the cat");
    }

    #[test]
    fn override_used_verbatim_when_no_placeholder() {
        let msgs =
            build_messages_with_override(Action::Edit, "the cat", Some("just respond with 'ok'"));
        assert_eq!(msgs[1].content, "just respond with 'ok'");
    }

    #[test]
    fn empty_override_falls_back_to_default() {
        let msgs = build_messages_with_override(Action::Edit, "the cat", Some("   "));
        let default = default_user_prompt(Action::Edit, "the cat");
        assert_eq!(msgs[1].content, default);
    }

    #[test]
    fn action_key_matches_frontend_lowercase() {
        assert_eq!(Action::Summarize.as_key(), "summarize");
        assert_eq!(Action::Edit.as_key(), "edit");
        assert_eq!(Action::Elaborate.as_key(), "elaborate");
        assert_eq!(Action::Research.as_key(), "research");
    }

    #[test]
    fn from_str_parses_each_action() {
        for action in Action::ALL {
            assert_eq!(Action::from_str(action.as_key()).unwrap(), action);
        }
        assert!(Action::from_str("invalid").is_err());
    }
}
