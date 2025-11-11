import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "./core";
import type { Module } from "./types";

// Mock AI Dungeon's log function
(globalThis as any).log = () => {
  // Silent during tests
};

// Mock story card functions
let mockCard: { title: string; description: string } | null = null;

(globalThis as any).storyCards = [];

(globalThis as any).addStoryCard = (title: string, keys: string, entry: string, type: string) => {
  const id = (globalThis as any).storyCards.length;
  const card = { id, title, keys, entry, type };
  (globalThis as any).storyCards.push(card);
  return id;
};

(globalThis as any).removeStoryCard = (id: number) => {
  (globalThis as any).storyCards = (globalThis as any).storyCards.filter(
    (c: any) => c.id !== id
  );
};

(globalThis as any).updateStoryCard = (
  id: number,
  title: string,
  keys: string,
  entry: string,
  type: string
) => {
  const card = (globalThis as any).storyCards.find((c: any) => c.id === id);
  if (card) {
    card.title = title;
    card.keys = keys;
    card.entry = entry;
    card.type = type;
  }
};

// Mock module
const testModule: Module<{ enable: boolean; value: number }> = {
  name: "test",
  configSection: `--- Test ---
Enable: true
Value: 42`,
  validateConfig: (raw) => ({
    enable: typeof raw.enable === "boolean" ? raw.enable : true,
    value: typeof raw.value === "number" ? raw.value : 42,
  }),
  hooks: {},
};

// Mock module with space-separated name (like narrativeChecklist -> "Narrative Checklist")
const spacedModule: Module<{ enable: boolean; turns: number }> = {
  name: "narrativeChecklist",
  configSection: `--- Narrative Checklist ---
Enable: true
RemainingTurns: 10`,
  validateConfig: (raw) => ({
    enable: typeof raw.enable === "boolean" ? raw.enable : true,
    turns: typeof raw.remainingturns === "number" ? raw.remainingturns : 10,
  }),
  hooks: {},
};

describe("FoxTweaks - Config Updates", () => {
  let core: FoxTweaks;

  beforeEach(() => {
    mockCard = {
      title: "FoxTweaks Config",
      description: `--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`,
    };

    (globalThis as any).storyCards = [mockCard];
    core = new FoxTweaks();
    core.registerModule(testModule);
  });

  test("updateConfigValue updates card with PascalCase key", () => {
    core.updateConfigValue("test", "Enable", false);

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("Enable: false  # Test enable");
    expect(card.description).toContain("Value: 42  # Test value");
  });

  test("updateConfigValue updates card with camelCase key (case insensitive)", () => {
    core.updateConfigValue("test", "enable", false);

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("Enable: false  # Test enable");
  });

  test("updateConfigValue updates numeric value", () => {
    core.updateConfigValue("test", "Value", 100);

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("Value: 100  # Test value");
  });

  test("updateConfigValue preserves original key casing", () => {
    core.updateConfigValue("test", "value", 100);

    const card = (globalThis as any).storyCards[0];
    // Should preserve "Value" from card, not use "value" from update call
    expect(card.description).toContain("Value: 100");
    expect(card.description).not.toContain("value: 100");
  });

  test("updateConfigValue only updates correct section", () => {
    core.updateConfigValue("test", "Enable", false);

    const card = (globalThis as any).storyCards[0];
    const lines = card.description.split("\n");

    // Find the Test section Enable
    const testEnableIdx = lines.findIndex((l: string) =>
      l.includes("--- Test ---")
    );
    const testEnableLine = lines.slice(testEnableIdx).find((l: string) =>
      l.trim().startsWith("Enable:")
    );

    // Find the Other section Enable
    const otherEnableIdx = lines.findIndex((l: string) =>
      l.includes("--- Other ---")
    );
    const otherEnableLine = lines.slice(otherEnableIdx).find((l: string) =>
      l.trim().startsWith("Enable:")
    );

    expect(testEnableLine).toContain("Enable: false");
    expect(otherEnableLine).toContain("Enable: false");
  });

  test("updateConfigValue preserves comments", () => {
    core.updateConfigValue("test", "Enable", false);

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("Enable: false  # Test enable");
  });

  test("updateConfigValue works with space-separated section names", () => {
    // Regression test for bug where "narrativeChecklist" module name
    // didn't match "--- Narrative Checklist ---" section header
    mockCard = {
      title: "FoxTweaks Config",
      description: `--- Narrative Checklist ---
Enable: true
RemainingTurns: 10  # Turns remaining`,
    };

    (globalThis as any).storyCards = [mockCard];
    const core2 = new FoxTweaks();
    core2.registerModule(spacedModule);

    // Update using the module name (no spaces)
    core2.updateConfigValue("narrativeChecklist", "RemainingTurns", 5);

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("RemainingTurns: 5  # Turns remaining");
    expect(card.description).toContain("Enable: true");
  });

  test("updateConfigValue handles various space patterns in section names", () => {
    mockCard = {
      title: "FoxTweaks Config",
      description: `--- Markdown Headers ---
Enable: true
HeaderLevel: ##`,
    };

    (globalThis as any).storyCards = [mockCard];
    const core2 = new FoxTweaks();
    const markdownModule: Module<{ enable: boolean; level: string }> = {
      name: "markdownHeaders",
      configSection: `--- Markdown Headers ---
Enable: true
HeaderLevel: ##`,
      validateConfig: (raw) => ({
        enable: typeof raw.enable === "boolean" ? raw.enable : true,
        level: typeof raw.headerlevel === "string" ? raw.headerlevel : "##",
      }),
      hooks: {},
    };
    core2.registerModule(markdownModule);

    // Update using camelCase module name
    core2.updateConfigValue("markdownHeaders", "HeaderLevel", "###");

    const card = (globalThis as any).storyCards[0];
    expect(card.description).toContain("HeaderLevel: ###");
  });
});
