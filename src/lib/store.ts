// Zustand store for the panel state machine.
// Build out actions as phases progress (Phase 3 onwards).

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
      // Per IMPLEMENTATION_PLAN.md Phase 5: reset buffer on provider switch
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
      if (s.state.kind !== "streaming") return s;
      return {
        state: {
          kind: "error",
          selection: s.state.selection,
          action: s.state.action,
          error,
        },
      };
    }),

  back: () =>
    set((s) => {
      if (s.state.kind === "result" || s.state.kind === "error") {
        return { state: { kind: "picking", selection: s.state.selection } };
      }
      return s;
    }),

  reset: () => set({ state: { kind: "idle" } }),
}));
