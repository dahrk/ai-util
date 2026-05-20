import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("boots vitest + jsdom", () => {
    const el = document.createElement("div");
    el.textContent = "ok";
    document.body.append(el);
    expect(document.body.textContent).toContain("ok");
  });
});
