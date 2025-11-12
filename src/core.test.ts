import { describe, expect } from "bun:test";
import { FoxTweaks } from "./core";
import type { Module } from "./types";
import { testWithAiDungeonEnvironment, createConfigCard } from "./test-utils";
import { findConfigCard } from "./utils/storyCardHelpers";

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
  testWithAiDungeonEnvironment(
    "updateConfigValue updates card with PascalCase key",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.updateConfigValue("test", "Enable", false);

      const card = storyCards[0];
      expect(card?.description).toContain("Enable: false  # Test enable");
      expect(card?.description).toContain("Value: 42  # Test value");
    }
  );

  testWithAiDungeonEnvironment(
    "updateConfigValue updates card with camelCase key (case insensitive)",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.updateConfigValue("test", "enable", false);

      const card = storyCards[0];
      expect(card?.description).toContain("Enable: false  # Test enable");
    }
  );

  testWithAiDungeonEnvironment(
    "updateConfigValue updates numeric value",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.updateConfigValue("test", "Value", 100);

      const card = storyCards[0];
      expect(card?.description).toContain("Value: 100  # Test value");
    }
  );

  testWithAiDungeonEnvironment(
    "updateConfigValue preserves original key casing",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.updateConfigValue("test", "value", 100);

      const card = storyCards[0];
      // Should preserve "Value" from card, not use "value" from update call
      expect(card?.description).toContain("Value: 100");
      expect(card?.description).not.toContain("value: 100");
    }
  );

  testWithAiDungeonEnvironment(
    "updateConfigValue only updates correct section",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.updateConfigValue("test", "Enable", false);

      const card = storyCards[0];
      const lines = card?.description?.split("\n") || [];

      // Find the Test section Enable
      const testEnableIdx = lines.findIndex((l: string) =>
        l.includes("--- Test ---")
      );
      const testEnableLine = lines
        .slice(testEnableIdx)
        .find((l: string) => l.trim().startsWith("Enable:"));

      // Find the Other section Enable
      const otherEnableIdx = lines.findIndex((l: string) =>
        l.includes("--- Other ---")
      );
      const otherEnableLine = lines
        .slice(otherEnableIdx)
        .find((l: string) => l.trim().startsWith("Enable:"));

      expect(testEnableLine).toContain("Enable: false");
      expect(otherEnableLine).toContain("Enable: false");
    }
  );

  testWithAiDungeonEnvironment("updateConfigValue preserves comments", () => {
    createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value

--- Other ---
Enable: false`);

    const core = new FoxTweaks();
    core.registerModule(testModule);
    core.updateConfigValue("test", "Enable", false);

    const card = storyCards[0];
    expect(card?.description).toContain("Enable: false  # Test enable");
  });

  testWithAiDungeonEnvironment(
    "updateConfigValue works with space-separated section names",
    () => {
      // Regression test for bug where "narrativeChecklist" module name
      // didn't match "--- Narrative Checklist ---" section header
      createConfigCard(`--- Narrative Checklist ---
Enable: true
RemainingTurns: 10  # Turns remaining`);

      const core = new FoxTweaks();
      core.registerModule(spacedModule);

      // Update using the module name (no spaces)
      core.updateConfigValue("narrativeChecklist", "RemainingTurns", 5);

      const card = storyCards[0];
      expect(card?.description).toContain(
        "RemainingTurns: 5  # Turns remaining"
      );
      expect(card?.description).toContain("Enable: true");
    }
  );

  testWithAiDungeonEnvironment(
    "updateConfigValue handles various space patterns in section names",
    () => {
      createConfigCard(`--- Markdown Headers ---
Enable: true
HeaderLevel: ##`);

      const core = new FoxTweaks();
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
      core.registerModule(markdownModule);

      // Update using camelCase module name
      core.updateConfigValue("markdownHeaders", "HeaderLevel", "###");

      const card = storyCards[0];
      expect(card?.description).toContain("HeaderLevel: ###");
    }
  );
});

describe("FoxTweaks - Config Card Creation and Repair", () => {
  testWithAiDungeonEnvironment(
    "creates new config card with all modules disabled when no card exists",
    () => {
      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.registerModule(spacedModule);

      const config = core.loadConfig();

      const card = findConfigCard();

      expect(card).toBeDefined();
      expect(card?.description).toContain("--- Test ---");
      expect(card?.description).toContain("Enable: false");
      expect(card?.description).toContain("--- Narrative Checklist ---");
      expect(card?.description).toContain("Enable: false");

      const testEnableMatches = card?.description?.match(/Enable:\s*false/g);
      expect(testEnableMatches).toBeDefined();
      expect(testEnableMatches?.length).toBeGreaterThanOrEqual(2);
    }
  );

  testWithAiDungeonEnvironment(
    "adds missing modules as disabled to existing config card",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 42  # Test value`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.registerModule(spacedModule);

      core.loadConfig();

      const card = storyCards[0];

      expect(card?.description).toContain("--- Test ---");
      expect(card?.description).toContain("Enable: true");
      expect(card?.description).toContain("--- Narrative Checklist ---");

      const lines = card?.description?.split("\n") || [];
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
    }
  );

  testWithAiDungeonEnvironment(
    "preserves existing enabled modules when adding missing ones",
    () => {
      createConfigCard(`--- Test ---
Enable: true  # Test enable
Value: 100  # Test value`);

      const core = new FoxTweaks();
      core.registerModule(testModule);
      core.registerModule(spacedModule);

      core.loadConfig();

      const card = storyCards[0];

      const lines = card?.description?.split("\n") || [];
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
      expect(card?.description).toContain("Value: 100");
    }
  );
});

describe("FoxTweaks - Disable Config Sections", () => {
  testWithAiDungeonEnvironment(
    "disableConfigSection should set Enable to false",
    () => {
      const core = new FoxTweaks();
      const disableConfigSection = (core as any).disableConfigSection.bind(
        core
      );

      const enabledSection = `--- Test Module ---
Enable: true  # Enable/disable feature
MaxTurns: 3  # Number of turns`;

      const disabledSection = disableConfigSection(enabledSection);

      expect(disabledSection).toContain("Enable: false");
      expect(disabledSection).not.toContain("Enable: true");
    }
  );

  testWithAiDungeonEnvironment(
    "disableConfigSection should handle different Enable values",
    () => {
      const core = new FoxTweaks();
      const disableConfigSection = (core as any).disableConfigSection.bind(
        core
      );

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
    }
  );

  testWithAiDungeonEnvironment(
    "disableConfigSection should preserve other lines",
    () => {
      const core = new FoxTweaks();
      const disableConfigSection = (core as any).disableConfigSection.bind(
        core
      );

      const section = `--- Test Module ---
Enable: true  # Enable/disable feature
MaxTurns: 3  # Number of turns
Triggers: try, attempt, cast`;

      const disabled = disableConfigSection(section);

      expect(disabled).toContain("MaxTurns: 3  # Number of turns");
      expect(disabled).toContain("Triggers: try, attempt, cast");
      expect(disabled).toContain("--- Test Module ---");
    }
  );
});
