import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "../core";
import { BetterYou } from "./betteryou";
import { Paragraph } from "./paragraph";
import { Redundancy } from "./redundancy";
import { NarrativeChecklist } from "./narrativeChecklist";

interface History {
  text: string;
  type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
}

describe("Multi-Module Pipeline - Integration Tests", () => {
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

  test("should process input through BetterYou and output through Paragraph + Redundancy", () => {
    const initialHistory: History[] = [
      { text: "You enter a tavern.", type: "do" },
      { text: "The tavern is bustling with activity.", type: "continue" },
    ];
    (globalThis as any).history = initialHistory;

    const core = new FoxTweaks();
    core.registerModule(BetterYou);
    core.registerModule(Paragraph);
    core.registerModule(Redundancy);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours

--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const playerInput = "> You look at me and approach mine table.";
    const processedInput = hooks.onInput(playerInput);

    expect(processedInput).toContain("you");
    expect(processedInput).toContain("yours");

    const aiOutput = "You sit down at the table.\nYou order a drink.";
    const processedOutput = hooks.onOutput(aiOutput);

    expect(processedOutput).toContain("\n\n");
    expect(processedOutput).not.toContain("The tavern is bustling");
  });

  test("should handle successive outputs through full pipeline without duplication", () => {
    const initialHistory: History[] = [
      { text: "You begin your adventure.", type: "start" },
    ];
    (globalThis as any).history = initialHistory;

    const core = new FoxTweaks();
    core.registerModule(BetterYou);
    core.registerModule(Paragraph);
    core.registerModule(Redundancy);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- BetterYou ---
Enable: true

--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const firstOutput = "You find yourself in a dark forest.";
    const processedFirst = hooks.onOutput(firstOutput);

    (globalThis as any).history = [
      ...initialHistory,
      { text: processedFirst, type: "continue" },
      { text: "I look around.", type: "do" },
    ];

    const secondOutput = "You see tall trees surrounding you.";
    const processedSecond = hooks.onOutput(secondOutput);

    expect(processedSecond).not.toContain("dark forest");
    expect(processedSecond).toContain("tall trees");

    const outputsSimilar =
      processedSecond.includes(firstOutput) ||
      processedFirst.includes(secondOutput);
    expect(outputsSimilar).toBe(false);
  });

  test("should process identical outputs differently to avoid duplication", () => {
    const initialHistory: History[] = [
      { text: "You enter the room.", type: "do" },
      { text: "The room is dark and cold.", type: "continue" },
    ];
    (globalThis as any).history = initialHistory;

    const core = new FoxTweaks();
    core.registerModule(Paragraph);
    core.registerModule(Redundancy);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const firstOutput = "You see a door ahead.";
    const processedFirst = hooks.onOutput(firstOutput);

    (globalThis as any).history = [
      ...initialHistory,
      { text: processedFirst, type: "continue" },
    ];

    const secondOutput = "You see a door ahead.";
    const processedSecond = hooks.onOutput(secondOutput);

    expect(processedSecond).toBe(secondOutput);

    const duplicateCount = processedSecond.split("You see a door ahead").length - 1;
    expect(duplicateCount).toBe(1);
  });

  test("should handle all modules enabled with NarrativeChecklist", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(BetterYou);
    core.registerModule(Paragraph);
    core.registerModule(Redundancy);
    core.registerModule(NarrativeChecklist);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours

--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70

--- Narrative Checklist ---
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

    const playerInput = "> You look at me and mine belongings.";
    const processedInput = hooks.onInput(playerInput);
    expect(processedInput).toContain("you");

    const aiOutput = "You find a mysterious amulet.";
    const processedOutput = hooks.onOutput(aiOutput);

    expect(processedOutput).toBe(aiOutput);

    const updatedConfigCard = (globalThis as any).storyCards.find(
      (c: any) => c.title === "FoxTweaks Config"
    );
    expect(updatedConfigCard.description).toContain("RemainingTurns: 2");
  });

  test("should maintain output integrity through 10 successive AI responses", () => {
    const initialHistory: History[] = [
      { text: "You start your adventure.", type: "start" },
    ];
    (globalThis as any).history = [...initialHistory];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);
    core.registerModule(Redundancy);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const outputs = [
      "You find yourself in a mysterious cave.",
      "The cave walls glisten with moisture.",
      "You hear dripping water in the distance.",
      "A faint light appears ahead.",
      "You move toward the light cautiously.",
      "The light grows brighter as you approach.",
      "You discover an underground lake.",
      "The water is crystal clear.",
      "You see fish swimming below.",
      "You decide to rest by the water.",
    ];

    const processedOutputs: string[] = [];

    for (const output of outputs) {
      const processed = hooks.onOutput(output);
      processedOutputs.push(processed);

      expect(processed).toBeDefined();
      expect(processed.length).toBeGreaterThan(0);

      (globalThis as any).history = [
        ...(globalThis as any).history,
        { text: processed, type: "continue" },
      ];
    }

    for (let i = 0; i < processedOutputs.length; i++) {
      for (let j = i + 1; j < processedOutputs.length; j++) {
        const combined = processedOutputs[i] + processedOutputs[j];
        const fullCombined = combined.split(outputs[i]).length - 1;
        expect(fullCombined).toBeLessThanOrEqual(1);
      }
    }
  });
});
