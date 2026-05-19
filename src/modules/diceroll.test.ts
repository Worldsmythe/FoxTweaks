import { describe, test, expect } from "bun:test";
import { DiceRoll } from "./diceroll";

describe("DiceRoll Custom Sets", () => {
  test("parses nested customsets into outcome/word arrays", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      customsets: {
        confident: {
          outcomes: "S S s s s p p f f",
          words: "assuredly, confidently, doubtlessly, skillfully",
        },
        unconfident: {
          outcomes: "s s p p f f f F F",
          words: "clumsily, tentatively, doubtfully, hesitantly, haphazardly",
        },
      },
    });
    expect(config.customSets["confident"]).toEqual({
      outcomes: ["S", "S", "s", "s", "s", "p", "p", "f", "f"],
      words: ["assuredly", "confidently", "doubtlessly", "skillfully"],
    });
    expect(config.customSets["unconfident"]).toEqual({
      outcomes: ["s", "s", "p", "p", "f", "f", "f", "F", "F"],
      words: ["clumsily", "tentatively", "doubtfully", "hesitantly", "haphazardly"],
    });
  });

  test("accepts comma-separated outcomes", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      customsets: {
        confident: { outcomes: "S, s, p, f, F", words: "boldly" },
      },
    });
    expect(config.customSets["confident"]?.outcomes).toEqual(["S", "s", "p", "f", "F"]);
  });

  test("skips sets missing outcomes or words", () => {
    const config = DiceRoll.validateConfig({
      enable: true,
      customsets: {
        broken: { outcomes: "S s p" },
        alsoBroken: { words: "carefully" },
        valid: { outcomes: "S s p", words: "carefully" },
      },
    });
    expect(config.customSets["broken"]).toBeUndefined();
    expect(config.customSets["alsoBroken"]).toBeUndefined();
    expect(config.customSets["valid"]).toBeDefined();
  });

  test("returns empty object when customsets missing or wrong type", () => {
    expect(DiceRoll.validateConfig({ enable: true }).customSets).toEqual({});
    expect(DiceRoll.validateConfig({ enable: true, customsets: "nope" }).customSets).toEqual({});
    expect(DiceRoll.validateConfig({ enable: true, customsets: [] }).customSets).toEqual({});
  });
});

describe("DiceRoll Migration", () => {
  test("migrates flat custom-set keys to nested CustomSets block", () => {
    const oldSection = `--- Dice ---
Enable: true
Triggers: try, attempt
Default: S s p f F
Confident: S S s s s p p f f
Unconfident: s s p p f f f F F
ConfidentWords: assuredly, confidently
UnconfidentWords: clumsily, tentatively`;

    const migrated = DiceRoll.migrateConfigSection!(oldSection);
    expect(migrated).not.toMatch(/^Confident:/m);
    expect(migrated).not.toMatch(/^Unconfident:/m);
    expect(migrated).not.toMatch(/^ConfidentWords:/m);
    expect(migrated).not.toMatch(/^UnconfidentWords:/m);
    expect(migrated).toContain("CustomSets:");
    expect(migrated).toContain("  Confident:");
    expect(migrated).toContain("    Outcomes: S S s s s p p f f");
    expect(migrated).toContain("    Words: assuredly, confidently");
    expect(migrated).toContain("  Unconfident:");
    expect(migrated).toContain("    Outcomes: s s p p f f f F F");
    expect(migrated).toContain("    Words: clumsily, tentatively");
  });

  test("preserves reserved keys during migration", () => {
    const oldSection = `--- Dice ---
Enable: true
Triggers: try, attempt
Default: S s p f F
Confident: S S s p f
ConfidentWords: confidently`;

    const migrated = DiceRoll.migrateConfigSection!(oldSection);
    expect(migrated).toContain("Enable: true");
    expect(migrated).toContain("Triggers: try, attempt");
    expect(migrated).toContain("Default: S s p f F");
  });

  test("leaves already-migrated config unchanged", () => {
    const newSection = `--- Dice ---
Enable: true
CustomSets:
  Confident:
    Outcomes: S s p
    Words: boldly`;
    expect(DiceRoll.migrateConfigSection!(newSection)).toBe(newSection);
  });

  test("no-op when section has no custom-set keys", () => {
    const section = `--- Dice ---
Enable: true
Triggers: try
Default: S s p f F`;
    expect(DiceRoll.migrateConfigSection!(section)).toBe(section);
  });
});

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
