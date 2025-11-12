import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { BetterYou } from "./betteryou";
import { Paragraph } from "./paragraph";
import { Redundancy } from "./redundancy";
import { NarrativeChecklist } from "./narrativeChecklist";
import {
  testWithAiDungeonEnvironment,
  createConfigCard,
  addHistoryAction,
} from "../test-utils";
import { findConfigCard } from "../utils/storyCardHelpers";

describe("Multi-Module Pipeline - Integration Tests", () => {
  testWithAiDungeonEnvironment(
    "should process input through BetterYou and output through Paragraph + Redundancy",
    () => {
      addHistoryAction("You enter a tavern.", "do");
      addHistoryAction("The tavern is bustling with activity.", "continue");

      createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours

--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`);

      const core = new FoxTweaks();
      core.registerModule(BetterYou);
      core.registerModule(Paragraph);
      core.registerModule(Redundancy);

      const hooks = core.createHooks();

      const playerInput = "> You look at me and approach mine table.";
      const processedInput = hooks.onInput(playerInput);

      expect(processedInput).toContain("you");
      expect(processedInput).toContain("yours");

      const aiOutput = "You sit down at the table.\nYou order a drink.";
      const processedOutput = hooks.onOutput(aiOutput);

      expect(processedOutput).toContain("\n\n");
      expect(processedOutput).not.toContain("The tavern is bustling");
    }
  );

  testWithAiDungeonEnvironment(
    "should handle successive outputs through full pipeline without duplication",
    () => {
      addHistoryAction("You begin your adventure.", "start");

      createConfigCard(`--- BetterYou ---
Enable: true

--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`);

      const core = new FoxTweaks();
      core.registerModule(BetterYou);
      core.registerModule(Paragraph);
      core.registerModule(Redundancy);

      const hooks = core.createHooks();

      const firstOutput = "You find yourself in a dark forest.";
      const processedFirst = hooks.onOutput(firstOutput);

      addHistoryAction(processedFirst, "continue");
      addHistoryAction("I look around.", "do");

      const secondOutput = "You see tall trees surrounding you.";
      const processedSecond = hooks.onOutput(secondOutput);

      expect(processedSecond).not.toContain("dark forest");
      expect(processedSecond).toContain("tall trees");

      const outputsSimilar =
        processedSecond.includes(firstOutput) ||
        processedFirst.includes(secondOutput);
      expect(outputsSimilar).toBe(false);
    }
  );

  testWithAiDungeonEnvironment(
    "should process identical outputs differently to avoid duplication",
    () => {
      addHistoryAction("You enter the room.", "do");
      addHistoryAction("The room is dark and cold.", "continue");

      createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`);

      const core = new FoxTweaks();
      core.registerModule(Paragraph);
      core.registerModule(Redundancy);

      const hooks = core.createHooks();

      const firstOutput = "You see a door ahead.";
      const processedFirst = hooks.onOutput(firstOutput);

      addHistoryAction(processedFirst, "continue");

      const secondOutput = "You see a door ahead.";
      const processedSecond = hooks.onOutput(secondOutput);

      expect(processedSecond).toBe(secondOutput);

      const duplicateCount =
        processedSecond.split("You see a door ahead").length - 1;
      expect(duplicateCount).toBe(1);
    }
  );

  testWithAiDungeonEnvironment(
    "should handle all modules enabled with NarrativeChecklist",
    () => {
      createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours

--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70

--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 3
AlwaysIncludeInContext: false
MinContextChars: 2000`);

      const checklistLength = addStoryCard("nc_checklist", "", "checklist");
      const checklistCard =
        storyCards[
          (typeof checklistLength === "number"
            ? checklistLength
            : storyCards.length) - 1
        ];
      if (checklistCard) {
        checklistCard.title = "Narrative Checklist";
        checklistCard.description = "[ ] Complete the quest";
      }

      const core = new FoxTweaks();
      core.registerModule(BetterYou);
      core.registerModule(Paragraph);
      core.registerModule(Redundancy);
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      const playerInput = "> You look at me and mine belongings.";
      const processedInput = hooks.onInput(playerInput);
      expect(processedInput).toContain("you");

      const aiOutput = "You find a mysterious amulet.";
      const processedOutput = hooks.onOutput(aiOutput);

      expect(processedOutput).toBe(aiOutput);

      const updatedConfigCard = findConfigCard();
      expect(updatedConfigCard?.description).toContain("RemainingTurns: 2");
    }
  );

  testWithAiDungeonEnvironment(
    "should maintain output integrity through 10 successive AI responses",
    () => {
      addHistoryAction("You start your adventure.", "start");

      createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`);

      const core = new FoxTweaks();
      core.registerModule(Paragraph);
      core.registerModule(Redundancy);

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

        addHistoryAction(processed, "continue");
      }

      for (let i = 0; i < processedOutputs.length; i++) {
        for (let j = i + 1; j < processedOutputs.length; j++) {
          const outputI = processedOutputs[i];
          const outputJ = processedOutputs[j];
          const originalI = outputs[i];
          if (outputI && outputJ && originalI) {
            const combined = outputI + outputJ;
            const fullCombined = combined.split(originalI).length - 1;
            expect(fullCombined).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  );
});
