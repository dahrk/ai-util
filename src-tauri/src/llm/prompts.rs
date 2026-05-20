//! Action prompt templates.
//!
//! The "output ONLY" framing is doing real work — small fast models love to
//! preamble ("Sure! Here's your summary:") and that would end up pasted into
//! the user's document. Be strict.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Summarize,
    Edit,
    Elaborate,
    Research,
}

#[derive(Serialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

pub fn build_messages(action: Action, text: &str) -> Vec<Message> {
    let (system, user) = match action {
        Action::Summarize => (
            "You output ONLY the requested rewrite. No preamble, no quotes, no markdown unless the input had it.",
            format!("Summarize the following in 2–3 sentences:\n\n{text}"),
        ),
        Action::Edit => (
            "Rewrite for clarity and concision. Preserve meaning, voice, and any formatting. Output ONLY the rewrite.",
            text.to_string(),
        ),
        Action::Elaborate => (
            "Expand the input with more detail, examples, and context. Match the original tone. Output ONLY the expanded text.",
            text.to_string(),
        ),
        Action::Research => (
            "Provide concise factual context for the input topic in 3–5 sentences. Output ONLY the answer.",
            text.to_string(),
        ),
    };

    vec![
        Message {
            role: "system".into(),
            content: system.into(),
        },
        Message {
            role: "user".into(),
            content: user,
        },
    ]
}
