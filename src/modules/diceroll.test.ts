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

  test("parses outcome labels", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      outcomelabels: {
        S: "Amazing!",
        s: "Good",
        p: "OK",
        f: "Bad",
        F: "Terrible!",
      },
    });
    expect(config.outcomeLabels.S).toBe("Amazing!");
    expect(config.outcomeLabels.s).toBe("Good");
    expect(config.outcomeLabels.p).toBe("OK");
    expect(config.outcomeLabels.f).toBe("Bad");
    expect(config.outcomeLabels.F).toBe("Terrible!");
  });

  test("uses default outcome labels when not specified", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
    });
    expect(config.outcomeLabels.S).toBe("Critical Success!");
    expect(config.outcomeLabels.s).toBe("Success");
    expect(config.outcomeLabels.p).toBe("Partial Success");
    expect(config.outcomeLabels.f).toBe("Failure");
    expect(config.outcomeLabels.F).toBe("Critical Failure!");
  });

  test("allows additional custom outcome labels beyond defaults", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      outcomelabels: {
        S: "Critical Success!",
        s: "Success",
        p: "Partial Success",
        f: "Failure",
        F: "Critical Failure!",
        X: "Extreme Success!",
        Y: "Legendary!",
        Z: "Epic Fail!",
      },
    });
    expect(config.outcomeLabels.S).toBe("Critical Success!");
    expect(config.outcomeLabels.X).toBe("Extreme Success!");
    expect(config.outcomeLabels.Y).toBe("Legendary!");
    expect(config.outcomeLabels.Z).toBe("Epic Fail!");
  });

  test("backwards compatibility - works without outcome labels config", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      triggers: ["try", "attempt"],
      default: ["S", "s", "p", "f", "F"],
    });
    expect(config.enable).toBe(true);
    expect(config.triggers).toEqual(["try", "attempt"]);
    expect(config.default).toEqual(["S", "s", "p", "f", "F"]);
    expect(config.outcomeLabels.S).toBe("Critical Success!");
    expect(config.outcomeLabels.s).toBe("Success");
    expect(config.outcomeLabels.p).toBe("Partial Success");
    expect(config.outcomeLabels.f).toBe("Failure");
    expect(config.outcomeLabels.F).toBe("Critical Failure!");
  });

  test("uses defaults when keys missing", () => {
    const config = DiceRoll.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.triggers).toEqual([]);
    expect(config.default).toEqual([]);
    expect(config.outcomeLabels.S).toBe("Critical Success!");
  });
});
