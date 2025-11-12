import { describe, test, expect } from "bun:test";
import { BetterYou } from "./betteryou";

describe("BetterYou Config Parsing", () => {
  test("parses enable and replacements", () => {
    const config = BetterYou.validateConfig({
      enable: true,
      replacements: { me: "you", mine: "yours" },
    });
    expect(config.enable).toBe(true);
    expect(config.replacements).toEqual({ me: "you", mine: "yours" });
    expect(config.patterns).toEqual({});
  });

  test("parses patterns", () => {
    const config = BetterYou.validateConfig({
      enable: true,
      replacements: {},
      patterns: { ". you": ". You", '." you': '." You' },
    });
    expect(config.patterns).toEqual({ ". you": ". You", '." you': '." You' });
  });

  test("filters non-string replacement values", () => {
    const config = BetterYou.validateConfig({
      enable: true,
      replacements: { me: "you", count: 123, flag: true },
    });
    expect(config.replacements).toEqual({ me: "you" });
  });

  test("filters non-string pattern values", () => {
    const config = BetterYou.validateConfig({
      enable: true,
      patterns: { ". you": ". You", count: 123 },
    });
    expect(config.patterns).toEqual({ ". you": ". You" });
  });

  test("uses defaults when keys missing", () => {
    const config = BetterYou.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.replacements).toEqual({});
    expect(config.patterns).toEqual({});
  });
});
