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
  });

  test("filters non-string replacement values", () => {
    const config = BetterYou.validateConfig({
      enable: true,
      replacements: { me: "you", count: 123, flag: true },
    });
    expect(config.replacements).toEqual({ me: "you" });
  });

  test("uses defaults when keys missing", () => {
    const config = BetterYou.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.replacements).toEqual({});
  });
});
