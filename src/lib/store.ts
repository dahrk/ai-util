// Zustand store for the panel state machine.
//
// Mirrors the design-reference state set: idle | picking | streaming |
// result | error. The store is the single source of truth for which sub-view
// `Panel.tsx` renders. All transitions are intentional no-ops when called from
// the wrong source state, so listeners that fire late don't corrupt state.

import { create } from "zustand";
import type { Action, CompletionError, PanelState, Provider, Selection } from "./types";

interface PanelStore {
  state: PanelState;

  setSelection: (selection: Selection) => void;
  startAction: (action: Action, provider: Provider) => void;
  appendToken: (token: string) => void;
  switchProvider: (provider: Provider) => void;
  completeResult: (result: string) => void;
  fail: (error: CompletionError) => void;
  /** Re-run the same action with the same selection. From `result` or `error`. */
  retry: () => void;
  /** Result/error → picking, preserving the selection. */
  back: () => void;
  reset: () => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  state: { kind: "idle" },

  setSelection: (selection) => set({ state: { kind: "picking", selection } }),

  startAction: (action, provider) =>
    set((s) => {
      if (s.state.kind !== "picking") return s;
      return {
        state: {
          kind: "streaming",
          selection: s.state.selection,
          action,
          tokens: "",
          provider,
        },
      };
    }),

  appendToken: (token) =>
    set((s) => {
      if (s.state.kind !== "streaming") return s;
      return { state: { ...s.state, tokens: s.state.tokens + token } };
    }),

  switchProvider: (provider) =>
    set((s) => {
      if (s.state.kind !== "streaming") return s;
      // Contract: gateway emits provider_switched BEFORE the first OpenRouter
      // token, so resetting the buffer here is safe.
      return { state: { ...s.state, provider, tokens: "" } };
    }),

  completeResult: (result) =>
    set((s) => {
      if (s.state.kind !== "streaming") return s;
      return {
        state: {
          kind: "result",
          selection: s.state.selection,
          action: s.state.action,
          result,
        },
      };
    }),

  fail: (error) =>
    set((s) => {
      // Can fail from streaming (real error) or picking (offline preflight).
      if (s.state.kind === "streaming") {
        return {
          state: { kind: "error", selection: s.state.selection, action: s.state.action, error },
        };
      }
      if (s.state.kind === "picking") {
        return {
          state: { kind: "error", selection: s.state.selection, action: null, error },
        };
      }
      return s;
    }),

  retry: () =>
    set((s) => {
      if (s.state.kind !== "result" && s.state.kind !== "error") return s;
      const { selection, action } = s.state;
      if (!selection || !action) return s; // offline preflight: no action to retry.
      return {
        state: {
          kind: "streaming",
          selection,
          action,
          tokens: "",
          provider: "fireworks",
        },
      };
    }),

  back: () =>
    set((s) => {
      if (s.state.kind === "result" || s.state.kind === "error") {
        const selection = s.state.selection;
        if (selection) return { state: { kind: "picking", selection } };
        return { state: { kind: "idle" } };
      }
      return s;
    }),

  reset: () => set({ state: { kind: "idle" } }),
}));
