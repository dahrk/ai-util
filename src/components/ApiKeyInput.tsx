import { useCallback, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";

import { validateApiKey } from "../lib/tauri";
import "./ApiKeyInput.css";

interface Props {
  provider: "fireworks" | "openrouter";
  label: string;
  helpUrl?: string;
  value: string | null;
  onSave: (key: string) => void;
}

type ValidationState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; status: number | null }
  | { kind: "err"; status: number | null; message: string };

/**
 * Reveal/hide API key input with a Validate button. Validation uses the
 * Rust-mediated `validate_api_key` command so we don't have to grant the
 * frontend extra `http:` capability.
 */
export function ApiKeyInput({ provider, label, helpUrl, value, onSave }: Props) {
  const [draft, setDraft] = useState(value ?? "");
  const [revealed, setRevealed] = useState(false);
  const [state, setState] = useState<ValidationState>({ kind: "idle" });

  const validate = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const res = await validateApiKey(provider, draft);
      if (res.ok) {
        setState({ kind: "ok", status: res.status });
      } else {
        setState({
          kind: "err",
          status: res.status,
          message: res.message ?? "Validation failed",
        });
      }
    } catch (e) {
      setState({
        kind: "err",
        status: null,
        message: String(e),
      });
    }
  }, [draft, provider]);

  const save = useCallback(() => {
    onSave(draft);
  }, [draft, onSave]);

  return (
    <div className="api-key-input">
      <label className="api-key-input__label">
        <span className="api-key-input__name">{label}</span>
        {helpUrl && (
          <a
            className="api-key-input__help"
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get a key
          </a>
        )}
      </label>
      <div className="api-key-input__row">
        <input
          className="api-key-input__field"
          type={revealed ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Paste your ${label} key`}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-testid={`api-key-input-${provider}`}
        />
        <button
          type="button"
          className="api-key-input__icon"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide key" : "Reveal key"}
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      </div>
      <div className="api-key-input__actions">
        <button
          type="button"
          className="api-key-input__validate"
          onClick={() => void validate()}
          disabled={state.kind === "checking" || !draft}
          data-testid={`api-key-validate-${provider}`}
        >
          {state.kind === "checking" ? "Checking…" : "Validate"}
        </button>
        {state.kind === "ok" && (
          <span className="api-key-input__ok" data-testid={`api-key-status-ok-${provider}`}>
            <Check size={11} /> Valid
            {state.status !== null && <em>· {state.status}</em>}
          </span>
        )}
        {state.kind === "err" && (
          <span className="api-key-input__err" data-testid={`api-key-status-err-${provider}`}>
            <X size={11} /> {state.message}
          </span>
        )}
        <button
          type="button"
          className="api-key-input__save"
          onClick={save}
          disabled={draft === (value ?? "")}
          data-testid={`api-key-save-${provider}`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
