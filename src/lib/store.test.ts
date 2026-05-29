import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "./store";
import type { Selection } from "./types";

const SELECTION: Selection = { text: "hello world", source_app: "TextEdit" };

const reset = () => usePanelStore.getState().reset();

describe("usePanelStore", () => {
  beforeEach(reset);

  it("starts in idle", () => {
    expect(usePanelStore.getState().state.kind).toBe("idle");
  });

  it("setSelection moves idle → picking and stores the selection", () => {
    usePanelStore.getState().setSelection(SELECTION);
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("picking");
    if (s.kind === "picking") expect(s.selection).toEqual(SELECTION);
  });

  it("startAction only fires from picking", () => {
    // From idle — no-op.
    usePanelStore.getState().startAction("summarize", "fireworks");
    expect(usePanelStore.getState().state.kind).toBe("idle");

    // From picking — transitions to streaming.
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("summarize", "fireworks");
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("streaming");
    if (s.kind === "streaming") {
      expect(s.action).toBe("summarize");
      expect(s.tokens).toBe("");
      expect(s.provider).toBe("fireworks");
    }
  });

  it("appendToken only fires during streaming and accumulates", () => {
    // Idle — no-op.
    usePanelStore.getState().appendToken("foo");
    expect(usePanelStore.getState().state.kind).toBe("idle");

    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("edit", "fireworks");
    usePanelStore.getState().appendToken("Hello, ");
    usePanelStore.getState().appendToken("world");
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("streaming");
    if (s.kind === "streaming") expect(s.tokens).toBe("Hello, world");
  });

  it("switchProvider resets the tokens buffer per the gateway contract", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("edit", "fireworks");
    usePanelStore.getState().appendToken("partial output");
    usePanelStore.getState().switchProvider("openrouter");
    const s = usePanelStore.getState().state;
    if (s.kind === "streaming") {
      expect(s.tokens).toBe("");
      expect(s.provider).toBe("openrouter");
    } else {
      throw new Error("expected streaming state");
    }
  });

  it("completeResult transitions streaming → result preserving selection + action", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("research", "fireworks");
    usePanelStore.getState().completeResult("Final answer.");
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("result");
    if (s.kind === "result") {
      expect(s.result).toBe("Final answer.");
      expect(s.action).toBe("research");
      expect(s.selection).toEqual(SELECTION);
    }
  });

  it("fail transitions streaming → error", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("summarize", "fireworks");
    usePanelStore
      .getState()
      .fail({ fireworks_error: "boom", openrouter_error: "503" });
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("error");
    if (s.kind === "error") {
      expect(s.error.fireworks_error).toBe("boom");
      expect(s.action).toBe("summarize");
    }
  });

  it("fail transitions picking → error for offline preflight (no action)", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().fail({
      fireworks_error: "You appear to be offline.",
      openrouter_error: null,
    });
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("error");
    if (s.kind === "error") {
      expect(s.action).toBeNull();
      expect(s.selection).toEqual(SELECTION);
    }
  });

  it("retry returns error/result → streaming preserving selection + action", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("elaborate", "fireworks");
    usePanelStore.getState().completeResult("done");
    usePanelStore.getState().retry();
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("streaming");
    if (s.kind === "streaming") {
      expect(s.action).toBe("elaborate");
      expect(s.tokens).toBe("");
      expect(s.provider).toBe("fireworks");
    }
  });

  it("retry is a no-op when error has no action (offline preflight)", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().fail({
      fireworks_error: "offline",
      openrouter_error: null,
    });
    usePanelStore.getState().retry();
    // Stays in error: there's no action to retry.
    expect(usePanelStore.getState().state.kind).toBe("error");
  });

  it("back returns result → picking preserving selection", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("summarize", "fireworks");
    usePanelStore.getState().completeResult("x");
    usePanelStore.getState().back();
    const s = usePanelStore.getState().state;
    expect(s.kind).toBe("picking");
    if (s.kind === "picking") expect(s.selection).toEqual(SELECTION);
  });

  it("back from error returns to picking when a selection is present", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("summarize", "fireworks");
    usePanelStore
      .getState()
      .fail({ fireworks_error: "x", openrouter_error: "y" });
    usePanelStore.getState().back();
    expect(usePanelStore.getState().state.kind).toBe("picking");
  });

  it("back from error with no selection falls to idle", () => {
    // The null-selection error branch isn't reachable through the public
    // transitions (fail always carries the selection), so construct it
    // directly to cover back()'s idle fallback.
    usePanelStore.setState({
      state: {
        kind: "error",
        selection: null,
        action: null,
        error: { fireworks_error: "x", openrouter_error: "y" },
      },
    });
    usePanelStore.getState().back();
    expect(usePanelStore.getState().state.kind).toBe("idle");
  });

  it("reset returns to idle from any state", () => {
    usePanelStore.getState().setSelection(SELECTION);
    usePanelStore.getState().startAction("edit", "fireworks");
    usePanelStore.getState().reset();
    expect(usePanelStore.getState().state.kind).toBe("idle");
  });
});
