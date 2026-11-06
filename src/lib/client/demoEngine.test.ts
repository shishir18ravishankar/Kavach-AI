import { describe, it, expect } from "vitest";
import { demoAnswer } from "./demoEngine";
import { buildMessages } from "./ai";
import { DEMO_DOCS } from "@/lib/demo/brewline";

describe("demo engine (no AI)", () => {
  it("always labels itself as demo mode", () => {
    expect(demoAnswer("anything", DEMO_DOCS)).toMatch(/^DEMO MODE/);
  });
  it("answers top-N questions from CSV", () => {
    const a = demoAnswer("Who are our top 3 customers by annual revenue?", DEMO_DOCS);
    expect(a).toContain("Lotus Tech Park Canteen");
    expect(a).toContain("Riverside Hospital Cafeteria");
    expect(a).toContain("Hotel Saffron Bay");
  });
  it("finds the shortfall clause", () => {
    expect(demoAnswer("What is the penalty for a volume shortfall?", DEMO_DOCS)).toMatch(/15%/);
  });
});

describe("prompt builder", () => {
  it("includes documents and the question", () => {
    const m = buildMessages("Q?", [{ name: "a.txt", text: "hello" }]);
    expect(m[0].role).toBe("system");
    expect(m.map((x) => x.content).join()).toContain('<document name="a.txt">');
    expect(m[m.length - 1]).toEqual({ role: "user", content: "Q?" });
  });
});
