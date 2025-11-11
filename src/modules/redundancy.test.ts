import { describe, test, expect } from "bun:test";
import { Redundancy } from "./redundancy";

describe("Redundancy Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = Redundancy.validateConfig({
      enable: true,
      similaritythreshold: 85,
    });
    expect(config.enable).toBe(true);
    expect(config.similarityThreshold).toBe(85);
  });

  test("enforces min/max constraints on similaritythreshold", () => {
    const configLow = Redundancy.validateConfig({ similaritythreshold: -10 });
    expect(configLow.similarityThreshold).toBe(70);

    const configHigh = Redundancy.validateConfig({ similaritythreshold: 150 });
    expect(configHigh.similarityThreshold).toBe(70);
  });

  test("uses defaults when keys missing", () => {
    const config = Redundancy.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.similarityThreshold).toBe(70);
  });
});
