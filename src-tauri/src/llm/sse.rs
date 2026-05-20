//! SSE parser for OpenAI-compatible streaming chat completions.
//!
//! Each chunk arrives as `data: {json}\n\n` where the JSON has shape:
//!   { "choices": [{ "delta": { "content": "..." } }] }
//!
//! The stream terminates with `data: [DONE]`.

use serde::Deserialize;

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Delta,
}

#[derive(Deserialize, Default)]
struct Delta {
    #[serde(default)]
    content: Option<String>,
}

/// Parse a single SSE `data:` payload into an optional token.
///
/// Returns:
///   - `Ok(Some(token))` for a content chunk
///   - `Ok(None)` for empty content, role-only chunks, or `[DONE]`
///   - `Err(...)` for malformed JSON
pub fn parse_data_line(line: &str) -> Result<Option<String>, serde_json::Error> {
    let payload = line.trim_start_matches("data:").trim();
    if payload.is_empty() || payload == "[DONE]" {
        return Ok(None);
    }
    let chunk: StreamChunk = serde_json::from_str(payload)?;
    Ok(chunk
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.delta.content)
        .filter(|s| !s.is_empty()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_normal_content_chunk() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}"#;
        assert_eq!(parse_data_line(line).unwrap(), Some("Hello".to_string()));
    }

    #[test]
    fn done_terminator_returns_none() {
        assert_eq!(parse_data_line("data: [DONE]").unwrap(), None);
    }

    #[test]
    fn role_only_delta_returns_none() {
        let line = r#"data: {"choices":[{"delta":{"role":"assistant"}}]}"#;
        assert_eq!(parse_data_line(line).unwrap(), None);
    }

    #[test]
    fn empty_content_returns_none() {
        let line = r#"data: {"choices":[{"delta":{"content":""}}]}"#;
        assert_eq!(parse_data_line(line).unwrap(), None);
    }

    #[test]
    fn malformed_json_returns_err() {
        assert!(parse_data_line("data: {not json").is_err());
    }

    #[test]
    fn whitespace_and_empty_payload_return_none() {
        assert_eq!(parse_data_line("data: ").unwrap(), None);
        assert_eq!(parse_data_line("data:").unwrap(), None);
    }

    #[test]
    fn multi_choice_uses_first_choice() {
        let line =
            r#"data: {"choices":[{"delta":{"content":"first"}},{"delta":{"content":"second"}}]}"#;
        assert_eq!(parse_data_line(line).unwrap(), Some("first".to_string()));
    }
}
