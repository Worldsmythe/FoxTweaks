import { describe, test, expect } from "bun:test";
import { NarrativeChecklist } from "./narrativeChecklist";

describe("NarrativeChecklist Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = NarrativeChecklist.validateConfig({
      enable: true,
      minturnsbeforecheck: 10,
      remainingturns: 5,
      alwaysincludeincontext: false,
      mincontextchars: 1000,
    });
    expect(config.enable).toBe(true);
    expect(config.minTurnsBeforeCheck).toBe(10);
    expect(config.remainingTurns).toBe(5);
    expect(config.alwaysIncludeInContext).toBe(false);
    expect(config.minContextChars).toBe(1000);
  });

  test("enforces min constraint on minturnsbeforecheck", () => {
    const config = NarrativeChecklist.validateConfig({ minturnsbeforecheck: 0 });
    expect(config.minTurnsBeforeCheck).toBe(50);
  });

  test("enforces min constraint on mincontextchars", () => {
    const config = NarrativeChecklist.validateConfig({ mincontextchars: 50 });
    expect(config.minContextChars).toBe(2000);
  });

  test("uses defaults when keys missing", () => {
    const config = NarrativeChecklist.validateConfig({});
    expect(config.enable).toBe(true);
    expect(config.minTurnsBeforeCheck).toBe(50);
    expect(config.remainingTurns).toBe(50);
    expect(config.alwaysIncludeInContext).toBe(true);
    expect(config.minContextChars).toBe(2000);
  });
});
