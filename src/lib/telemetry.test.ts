import { describe, expect, it } from "vitest";
import { emptyBuffer, MAX_SAMPLES, push, reduce } from "./telemetry";

describe("reduce()", () => {
  it("hotkey resets state and stores the timestamp", () => {
    const { state, sample } = reduce({ hotkeyAt: 1, visibleAt: 2, firstTokenAt: 3 }, "hotkey", 100);
    expect(sample).toBeNull();
    expect(state).toEqual({ hotkeyAt: 100, visibleAt: null, firstTokenAt: null });
  });

  it("visible + first_token accumulate", () => {
    let s: { hotkeyAt: number | null; visibleAt: number | null; firstTokenAt: number | null } = {
      hotkeyAt: null,
      visibleAt: null,
      firstTokenAt: null,
    };
    s = reduce(s, "hotkey", 100).state;
    s = reduce(s, "visible", 200).state;
    expect(s.visibleAt).toBe(200);
    s = reduce(s, "first_token", 350).state;
    expect(s.firstTokenAt).toBe(350);
  });

  it("done builds a full sample and resets state", () => {
    let s: { hotkeyAt: number | null; visibleAt: number | null; firstTokenAt: number | null } = {
      hotkeyAt: null,
      visibleAt: null,
      firstTokenAt: null,
    };
    s = reduce(s, "hotkey", 100).state;
    s = reduce(s, "visible", 200).state;
    s = reduce(s, "first_token", 350).state;
    const { state, sample } = reduce(s, "done", 1000);
    expect(state).toEqual({ hotkeyAt: null, visibleAt: null, firstTokenAt: null });
    expect(sample).not.toBeNull();
    expect(sample!.hotkeyToVisibleMs).toBe(100);
    expect(sample!.firstTokenMs).toBe(150);
    expect(sample!.tokenToDoneMs).toBe(650);
    expect(sample!.capturedAt).toBe(1000);
  });

  it("done with missing intermediate events yields null fields", () => {
    let s: { hotkeyAt: number | null; visibleAt: number | null; firstTokenAt: number | null } = {
      hotkeyAt: null,
      visibleAt: null,
      firstTokenAt: null,
    };
    s = reduce(s, "hotkey", 100).state;
    const { sample } = reduce(s, "done", 500);
    expect(sample).not.toBeNull();
    expect(sample!.hotkeyToVisibleMs).toBeNull();
    expect(sample!.firstTokenMs).toBeNull();
    expect(sample!.tokenToDoneMs).toBeNull();
  });

  it("clamps negative deltas to 0 (clock skew defense)", () => {
    let s: { hotkeyAt: number | null; visibleAt: number | null; firstTokenAt: number | null } = {
      hotkeyAt: null,
      visibleAt: null,
      firstTokenAt: null,
    };
    s = reduce(s, "hotkey", 1000).state;
    s = reduce(s, "visible", 999).state; // implausibly before hotkey
    s = reduce(s, "first_token", 1100).state;
    const { sample } = reduce(s, "done", 1200);
    expect(sample!.hotkeyToVisibleMs).toBe(0);
  });
});

describe("push()", () => {
  it("appends samples", () => {
    const a = push(emptyBuffer(), {
      hotkeyToVisibleMs: 10,
      firstTokenMs: 20,
      tokenToDoneMs: 30,
      capturedAt: 1,
    });
    expect(a.samples).toHaveLength(1);
  });

  it("caps at MAX_SAMPLES, evicting the oldest first", () => {
    let buf = emptyBuffer();
    for (let i = 0; i < MAX_SAMPLES + 5; i++) {
      buf = push(buf, {
        hotkeyToVisibleMs: i,
        firstTokenMs: i,
        tokenToDoneMs: i,
        capturedAt: i,
      });
    }
    expect(buf.samples).toHaveLength(MAX_SAMPLES);
    // First sample should be sample index 5 (0..4 evicted).
    expect(buf.samples[0].capturedAt).toBe(5);
    expect(buf.samples[MAX_SAMPLES - 1].capturedAt).toBe(MAX_SAMPLES + 4);
  });
});
