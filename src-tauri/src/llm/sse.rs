//! Phase 4: SSE parser for OpenAI-compatible streaming.
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

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}

/// Parse a single SSE data line into an optional token. Returns:
///   - Ok(Some(token)) for a content chunk
///   - Ok(None)        for empty content, role-only chunks, or [DONE]
///   - Err(...)        for malformed JSON
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
        .and_then(|c| c.delta.content))
}

// TODO Phase 4:
//   - hook this up in gateway.rs using eventsource-stream to read the response
//   - emit each token via the on_token callback
//   - check the cancel token between chunks
