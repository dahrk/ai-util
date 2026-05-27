// Browser-side replacement for src-tauri/src/llm/gateway.rs + sse.rs.
//
// Streams a chat completion via fetch + ReadableStream (EventSource can't
// set Authorization headers). Parsing logic mirrors sse::parse_data_line:
// `data: {json}\n\n` per chunk, terminated by `data: [DONE]`.
//
// Cancellation: caller passes an AbortSignal. We respect it both at fetch
// time and inside the read loop.

import type { ChatMessage } from "./prompts";

const FIREWORKS_CHAT_URL =
  "https://api.fireworks.ai/inference/v1/chat/completions";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type Provider = "fireworks" | "openrouter";

export interface RunArgs {
  provider: Provider;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

interface ChoiceDelta {
  content?: string | null;
}
interface StreamChoice {
  delta?: ChoiceDelta;
}
interface StreamChunk {
  choices?: StreamChoice[];
}

/** Returns the full concatenated text on success; throws on failure. */
export async function streamCompletion(args: RunArgs): Promise<string> {
  const url =
    args.provider === "fireworks" ? FIREWORKS_CHAT_URL : OPENROUTER_CHAT_URL;

  const body = {
    model: args.model,
    messages: args.messages,
    stream: true,
    max_tokens: args.maxTokens,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!resp.ok) {
    let detail: string;
    try {
      detail = await resp.text();
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    throw new Error(`Fireworks ${resp.status}: ${detail.slice(0, 400)}`);
  }
  if (!resp.body) throw new Error("Fireworks returned empty body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";

  // Streaming SSE framing: events separated by blank lines (\n\n). A
  // single event may span multiple chunks, so we accumulate and split.
  while (true) {
    if (args.signal.aborted) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new DOMException("aborted", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const event = buf.slice(0, sep);
      buf = buf.slice(sep + 2);

      // An SSE event may contain multiple `data:` lines, but the OpenAI/
      // Fireworks streaming format only uses one per event. Be lenient.
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        const tok = chunk.choices?.[0]?.delta?.content;
        if (tok) {
          full += tok;
          args.onToken(tok);
        }
      }
    }
  }
  return full;
}

/** GET /v1/models — used by the live ModelDropdown. */
export async function fetchModels(
  provider: Provider,
  apiKey: string,
): Promise<{ id: string; label: string | null }[]> {
  const url =
    provider === "fireworks"
      ? "https://api.fireworks.ai/inference/v1/models"
      : "https://openrouter.ai/api/v1/models";
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) throw new Error(`models ${resp.status}`);
  const json = (await resp.json()) as {
    data: { id: string; name?: string }[];
  };
  return (json.data ?? [])
    .filter((m) => m.id)
    // For Fireworks, only chat-capable models. For OpenRouter the catalog is
    // huge but the user picks freely — we don't try to filter there.
    .map((m) => ({ id: m.id, label: m.name ?? null }));
}

/** Lightweight key check — calls /v1/models, returns {ok, status}. */
export async function validateKey(
  provider: Provider,
  key: string,
): Promise<{ ok: boolean; status: number | null; message: string | null }> {
  const url =
    provider === "fireworks"
      ? "https://api.fireworks.ai/inference/v1/models"
      : "https://openrouter.ai/api/v1/models";
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (resp.ok) return { ok: true, status: resp.status, message: null };
    const body = await resp.text().catch(() => "");
    return {
      ok: false,
      status: resp.status,
      message: body.slice(0, 240) || `HTTP ${resp.status}`,
    };
  } catch (e) {
    return { ok: false, status: null, message: String(e) };
  }
}
