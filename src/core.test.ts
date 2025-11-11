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

describe("FoxTweaks - Config Card Creation and Repair", () => {
  beforeEach(() => {
    (globalThis as any).storyCards = [];
    (globalThis as any).state = {};
  });

  test("creates new config card with all modules disabled when no card exists", () => {
    const core = new FoxTweaks();
    core.registerModule(testModule);
    core.registerModule(spacedModule);

    const config = core.loadConfig();

    const card = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );

    expect(card).toBeDefined();
    expect(card.description).toContain("--- Test ---");
    expect(card.description).toContain("Enable: false");
    expect(card.description).toContain("--- Narrative Checklist ---");
    expect(card.description).toContain("Enable: false");

    const testEnableMatches = card.description.match(/Enable:\s*false/g);
    expect(testEnableMatches).toBeDefined();
    expect(testEnableMatches.length).toBeGreaterThanOrEqual(2);
  });

  test("adds missing modules as disabled to existing config card", () => {
    const existingCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Test ---
Enable: true  # Test enable
Value: 42  # Test value`,
      type: "class",
      entry: "",
    };

    (globalThis as any).storyCards = [existingCard];

    const core = new FoxTweaks();
    core.registerModule(testModule);
    core.registerModule(spacedModule);

    core.loadConfig();

    const card = (globalThis as any).storyCards[0];

    expect(card.description).toContain("--- Test ---");
    expect(card.description).toContain("Enable: true");
    expect(card.description).toContain("--- Narrative Checklist ---");

    const lines = card.description.split("\n");
    let inNarrativeChecklistSection = false;
    let foundNarrativeChecklistEnable = false;

    for (const line of lines) {
      if (line.includes("--- Narrative Checklist ---")) {
        inNarrativeChecklistSection = true;
      } else if (line.trim().startsWith("---")) {
        inNarrativeChecklistSection = false;
      }

      if (inNarrativeChecklistSection && line.trim().startsWith("Enable:")) {
        expect(line).toContain("Enable: false");
        foundNarrativeChecklistEnable = true;
      }
    }

    expect(foundNarrativeChecklistEnable).toBe(true);
  });

  test("preserves existing enabled modules when adding missing ones", () => {
    const existingCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Test ---
Enable: true  # Test enable
Value: 100  # Test value`,
      type: "class",
      entry: "",
    };

    (globalThis as any).storyCards = [existingCard];

    const core = new FoxTweaks();
    core.registerModule(testModule);
    core.registerModule(spacedModule);

    core.loadConfig();

    const card = (globalThis as any).storyCards[0];

    const lines = card.description.split("\n");
    let inTestSection = false;
    let testEnableValue = "";

    for (const line of lines) {
      if (line.includes("--- Test ---")) {
        inTestSection = true;
      } else if (line.trim().startsWith("---")) {
        inTestSection = false;
      }

      if (inTestSection && line.trim().startsWith("Enable:")) {
        testEnableValue = line;
      }
    }

    expect(testEnableValue).toContain("Enable: true");
    expect(card.description).toContain("Value: 100");
  });
});

describe("FoxTweaks - Disable Config Sections", () => {
  let core: FoxTweaks;

  beforeEach(() => {
    core = new FoxTweaks();
  });

  test("disableConfigSection should set Enable to false", () => {
    const disableConfigSection = (core as any).disableConfigSection.bind(core);

    const enabledSection = `--- Test Module ---
Enable: true  # Enable/disable feature
MaxTurns: 3  # Number of turns`;

    const disabledSection = disableConfigSection(enabledSection);

    expect(disabledSection).toContain("Enable: false");
    expect(disabledSection).not.toContain("Enable: true");
  });

  test("disableConfigSection should handle different Enable values", () => {
    const disableConfigSection = (core as any).disableConfigSection.bind(core);

    const sections = [
      `Enable: true  # Comment`,
      `Enable: false  # Comment`,
      `Enable: yes  # Comment`,
      `  Enable: 1  # Comment`,
    ];

    for (const section of sections) {
      const disabled = disableConfigSection(section);
      expect(disabled).toContain("Enable: false  # Comment");
    }
  });

  test("disableConfigSection should preserve other lines", () => {
    const disableConfigSection = (core as any).disableConfigSection.bind(core);

    const section = `--- Test Module ---
Enable: true  # Enable/disable feature
MaxTurns: 3  # Number of turns
Triggers: try, attempt, cast`;

    const disabled = disableConfigSection(section);

    expect(disabled).toContain("MaxTurns: 3  # Number of turns");
    expect(disabled).toContain("Triggers: try, attempt, cast");
    expect(disabled).toContain("--- Test Module ---");
  });
});
