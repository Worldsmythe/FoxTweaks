import { describe, test, expect } from "bun:test";
import { Interject } from "./interject";

describe("Interject Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = Interject.validateConfig({
      enable: true,
      maxturns: 5,
      remainingturns: 2,
    });
    expect(config.enable).toBe(true);
    expect(config.maxTurns).toBe(5);
    expect(config.remainingTurns).toBe(2);
  });

  test("uses defaults when keys missing", () => {
    const config = Interject.validateConfig({});
    expect(config.maxTurns).toBe(3);
    expect(config.remainingTurns).toBe(0);
  });

  test("enforces min constraint on maxturns", () => {
    const config = Interject.validateConfig({ maxturns: 0 });
    expect(config.maxTurns).toBe(3);
  });
});
