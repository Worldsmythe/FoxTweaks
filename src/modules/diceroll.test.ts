import { describe, test, expect } from "bun:test";
import { DiceRoll } from "./diceroll";

describe("DiceRoll Config Parsing", () => {
  test("parses enable key", () => {
    const config = DiceRoll.validateConfig({ enable: true });
    expect(config.enable).toBe(true);
  });

  test("parses triggers", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      triggers: ["try", "attempt"],
    });
    expect(config.triggers).toEqual(["try", "attempt"]);
  });

  test("parses default dice set", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      default: ["S", "s", "p", "f", "F"],
    });
    expect(config.default).toEqual(["S", "s", "p", "f", "F"]);
  });

  test("uses defaults when keys missing", () => {
    const config = DiceRoll.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.triggers).toEqual([]);
    expect(config.default).toEqual([]);
  });
});
