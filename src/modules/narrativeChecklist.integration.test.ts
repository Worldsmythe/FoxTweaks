import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "../core";
import { NarrativeChecklist } from "./narrativeChecklist";

interface History {
  text: string;
  type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
}

describe("NarrativeChecklist Module - Integration Tests", () => {
  beforeEach(() => {
    (globalThis as any).log = () => {};
    (globalThis as any).storyCards = [];
    (globalThis as any).state = {};
    (globalThis as any).info = {};
    (globalThis as any).addStoryCard = (keys: string) => {
      const newCard = {
        id: (globalThis as any).storyCards.length,
        title: "",
        keys,
        description: "",
        type: "",
        entry: "",
      };
      (globalThis as any).storyCards.push(newCard);
    };
  });

  test("should decrement remaining turns on each output", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    const checklistCard = {
      id: 1,
      title: "Narrative Checklist",
      keys: "nc_checklist",
      description: "[ ] Complete the quest\n[ ] Find the artifact",
      type: "checklist",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard, checklistCard];

    const hooks = core.createHooks();

    const output = "You continue your adventure.";
    hooks.onOutput(output);

    const updatedConfigCard = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );

    expect(updatedConfigCard.description).toContain("RemainingTurns: 4");
  });

  test("should handle successive outputs and update turn counter", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 3
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    const checklistCard = {
      id: 1,
      title: "Narrative Checklist",
      keys: "nc_checklist",
      description: "[ ] Complete the quest",
      type: "checklist",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard, checklistCard];

    const hooks = core.createHooks();

    hooks.onOutput("First output.");
    hooks.onOutput("Second output.");
    hooks.onOutput("Third output.");

    const updatedConfigCard = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );

    expect(updatedConfigCard.description).toContain("RemainingTurns: 0");
  });

  test("should not decrement turns when module is disabled", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: false
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    hooks.onOutput("You continue your adventure.");

    const updatedConfigCard = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );

    expect(updatedConfigCard.description).toContain("RemainingTurns: 5");
  });

  test("should handle case where no checklist card exists", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "You continue your adventure.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  test("should not modify the output text", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    const checklistCard = {
      id: 1,
      title: "Narrative Checklist",
      keys: "nc_checklist",
      description: "[ ] Complete the quest",
      type: "checklist",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard, checklistCard];

    const hooks = core.createHooks();

    const output = "You find a treasure chest.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  test("should handle rapid successive outputs without errors", () => {
    const initialHistory: History[] = [
      { text: "You begin your quest.", type: "start" },
    ];
    (globalThis as any).history = initialHistory;

    const core = new FoxTweaks();
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 10
AlwaysIncludeInContext: false
MinContextChars: 2000`,
      type: "class",
      entry: "",
    };

    const checklistCard = {
      id: 1,
      title: "Narrative Checklist",
      keys: "nc_checklist",
      description: "[ ] Task 1\n[ ] Task 2\n[ ] Task 3",
      type: "checklist",
      entry: "",
    };

    (globalThis as any).storyCards = [configCard, checklistCard];

    const hooks = core.createHooks();

    for (let i = 0; i < 5; i++) {
      const output = `Output number ${i + 1}.`;
      const processed = hooks.onOutput(output);
      expect(processed).toBe(output);

      (globalThis as any).history = [
        ...initialHistory,
        { text: processed, type: "continue" },
      ];
    }

    const updatedConfigCard = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );

    expect(updatedConfigCard.description).toContain("RemainingTurns: 5");
  });
});
