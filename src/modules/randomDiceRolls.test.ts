import { describe, test, expect } from "bun:test";
import { RandomDiceRolls } from "./randomDiceRolls";
import { parseContext, getSection } from "../utils/virtualContext";
import { createHookContext } from "../test-utils";

describe("RandomDiceRolls Config Parsing", () => {
  test("parses enable key", () => {
    const config = RandomDiceRolls.validateConfig({ enable: true });
    expect(config.enable).toBe(true);
  });

  test("defaults enable to false", () => {
    const config = RandomDiceRolls.validateConfig({});
    expect(config.enable).toBe(false);
  });

  test("parses section header", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      sectionheader: "Custom Rolls",
    });
    expect(config.sectionHeader).toBe("Custom Rolls");
  });

  test("defaults section header", () => {
    const config = RandomDiceRolls.validateConfig({});
    expect(config.sectionHeader).toBe("Dice Rolls");
  });

  test("parses roll definitions", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        "Test Roll": "1d100",
        "Another Roll": "2d6",
      },
    });
    expect(config.rolls).toEqual({
      "Test Roll": "1d100",
      "Another Roll": "2d6",
    });
  });

  test("defaults to empty rolls object", () => {
    const config = RandomDiceRolls.validateConfig({});
    expect(config.rolls).toEqual({});
  });
});

describe("RandomDiceRolls Context Injection", () => {
  const mockContext = createHookContext();

  test("injects roll results into Memories section", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      sectionheader: "Dice Rolls",
      rolls: {
        "Test Roll": "50",
      },
    });

    const text = "Some context\n\nRecent Story:\nSome story";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Dice Rolls:");
      expect(body).toContain("Test Roll: 50");
    }
  });

  test("does not inject when disabled", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: false,
      rolls: {
        "Test Roll": "1d100",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      expect(result.postamble).toBe("");
    }
  });

  test("does not inject when no rolls defined", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {},
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      expect(result.postamble).toBe("");
    }
  });

  test("evaluates arithmetic expressions", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        Test: "10 + 5",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Test: 15");
    }
  });

  test("evaluates max function", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        "Max Test": "max(10, 5)",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Max Test: 10");
    }
  });

  test("evaluates min function", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        "Min Test": "min(10, 5)",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Min Test: 5");
    }
  });

  test("evaluates dice notation", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        "Dice Test": "1d6",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Dice Test:");
      const match = body.match(/Dice Test: (\d+)/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1] || "0", 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    }
  });

  test("evaluates complex expressions", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        Complex: "max(5-10, 0)",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Complex: 0");
    }
  });

  test("handles multiple rolls", () => {
    const config = RandomDiceRolls.validateConfig({
      enable: true,
      rolls: {
        "Roll 1": "10",
        "Roll 2": "20",
        "Roll 3": "30",
      },
    });

    const text = "Some context";
    const ctx = parseContext(text, []);
    const result = RandomDiceRolls.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Memories")?.body ?? "";
      expect(body).toContain("Roll 1: 10");
      expect(body).toContain("Roll 2: 20");
      expect(body).toContain("Roll 3: 30");
    }
  });
});
