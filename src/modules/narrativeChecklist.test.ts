import { describe, test, expect } from "bun:test";
import { NarrativeChecklist, type NarrativeChecklistConfig } from "./narrativeChecklist";
import { parseConfig } from "../config";

describe("NarrativeChecklist Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = NarrativeChecklist.validateConfig({
      enable: true,
      maxturnsbeforecheck: 10,
      remainingturns: 5,
      alwaysincludeincontext: false,
      mincontextchars: 1000,
    });
    expect(config.enable).toBe(true);
    expect(config.maxTurnsBeforeCheck).toBe(10);
    expect(config.remainingTurns).toBe(5);
    expect(config.alwaysIncludeInContext).toBe(false);
    expect(config.minContextChars).toBe(1000);
  });

  test("enforces min constraint on maxturnsbeforecheck", () => {
    const config = NarrativeChecklist.validateConfig({ maxturnsbeforecheck: 0 });
    expect(config.maxTurnsBeforeCheck).toBe(50);
  });

  test("supports legacy minturnsbeforecheck for backwards compatibility", () => {
    const config = NarrativeChecklist.validateConfig({ minturnsbeforecheck: 25 });
    expect(config.maxTurnsBeforeCheck).toBe(25);
  });

  test("prefers maxturnsbeforecheck over minturnsbeforecheck", () => {
    const config = NarrativeChecklist.validateConfig({
      maxturnsbeforecheck: 30,
      minturnsbeforecheck: 25,
    });
    expect(config.maxTurnsBeforeCheck).toBe(30);
  });

  test("enforces min constraint on mincontextchars", () => {
    const config = NarrativeChecklist.validateConfig({ mincontextchars: 50 });
    expect(config.minContextChars).toBe(2000);
  });

  test("uses defaults when keys missing", () => {
    const config = NarrativeChecklist.validateConfig({});
    expect(config.enable).toBe(true);
    expect(config.maxTurnsBeforeCheck).toBe(50);
    expect(config.remainingTurns).toBe(50);
    expect(config.alwaysIncludeInContext).toBe(true);
    expect(config.minContextChars).toBe(2000);
  });
});

describe("NarrativeChecklist Config Migration", () => {
  test("parses new config format with MaxTurnsBeforeCheck", () => {
    const configString = `--- Narrative Checklist ---
Enable: true
MaxTurnsBeforeCheck: 30
RemainingTurns: 30
AlwaysIncludeInContext: true
MinContextChars: 2000`;

    const parsed = parseConfig<{ narrativeChecklist: NarrativeChecklistConfig }>(
      configString,
      [NarrativeChecklist] as any
    );

    expect(parsed.narrativeChecklist.enable).toBe(true);
    expect(parsed.narrativeChecklist.maxTurnsBeforeCheck).toBe(30);
    expect(parsed.narrativeChecklist.remainingTurns).toBe(30);
    expect(parsed.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(parsed.narrativeChecklist.minContextChars).toBe(2000);
  });

  test("parses old config format with MinTurnsBeforeCheck and migrates to MaxTurnsBeforeCheck", () => {
    const oldConfigString = `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 40
RemainingTurns: 40
AlwaysIncludeInContext: true
MinContextChars: 2000`;

    const parsed = parseConfig<{ narrativeChecklist: NarrativeChecklistConfig }>(
      oldConfigString,
      [NarrativeChecklist] as any
    );

    expect(parsed.narrativeChecklist.enable).toBe(true);
    expect(parsed.narrativeChecklist.maxTurnsBeforeCheck).toBe(40);
    expect(parsed.narrativeChecklist.remainingTurns).toBe(40);
    expect(parsed.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(parsed.narrativeChecklist.minContextChars).toBe(2000);
  });

  test("prefers MaxTurnsBeforeCheck when both Min and Max are present", () => {
    const mixedConfigString = `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 25
MaxTurnsBeforeCheck: 35
RemainingTurns: 35
AlwaysIncludeInContext: false
MinContextChars: 1500`;

    const parsed = parseConfig<{ narrativeChecklist: NarrativeChecklistConfig }>(
      mixedConfigString,
      [NarrativeChecklist] as any
    );

    expect(parsed.narrativeChecklist.enable).toBe(true);
    expect(parsed.narrativeChecklist.maxTurnsBeforeCheck).toBe(35);
    expect(parsed.narrativeChecklist.remainingTurns).toBe(35);
    expect(parsed.narrativeChecklist.alwaysIncludeInContext).toBe(false);
    expect(parsed.narrativeChecklist.minContextChars).toBe(1500);
  });

  test("handles old config with invalid MinTurnsBeforeCheck value", () => {
    const invalidOldConfigString = `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 0
RemainingTurns: 50
AlwaysIncludeInContext: true
MinContextChars: 2000`;

    const parsed = parseConfig<{ narrativeChecklist: NarrativeChecklistConfig }>(
      invalidOldConfigString,
      [NarrativeChecklist] as any
    );

    expect(parsed.narrativeChecklist.maxTurnsBeforeCheck).toBe(50);
  });

  test("parses default config section with new format", () => {
    const defaultConfig = NarrativeChecklist.configSection;
    const parsed = parseConfig<{ narrativeChecklist: NarrativeChecklistConfig }>(
      defaultConfig,
      [NarrativeChecklist] as any
    );

    expect(parsed.narrativeChecklist.enable).toBe(true);
    expect(parsed.narrativeChecklist.maxTurnsBeforeCheck).toBe(50);
    expect(parsed.narrativeChecklist.remainingTurns).toBe(50);
    expect(parsed.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(parsed.narrativeChecklist.minContextChars).toBe(2000);
  });
});
