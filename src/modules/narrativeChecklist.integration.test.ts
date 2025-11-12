import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { NarrativeChecklist } from "./narrativeChecklist";
import {
  testWithAiDungeonEnvironment,
  createConfigCard,
  addHistoryAction,
} from "../test-utils";
import { findConfigCard } from "../utils/storyCardHelpers";

describe("NarrativeChecklist Module - Integration Tests", () => {
  testWithAiDungeonEnvironment(
    "should decrement remaining turns on each output",
    () => {
      createConfigCard(`--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
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
        checklistCard.description =
          "[ ] Complete the quest\n[ ] Find the artifact";
      }

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      const output = "You continue your adventure.";
      hooks.onOutput(output);

      const updatedConfigCard = findConfigCard();

      expect(updatedConfigCard?.description).toContain("RemainingTurns: 4");
    }
  );

  testWithAiDungeonEnvironment(
    "should handle successive outputs and update turn counter",
    () => {
      createConfigCard(`--- Narrative Checklist ---
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
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      hooks.onOutput("First output.");
      hooks.onOutput("Second output.");
      hooks.onOutput("Third output.");

      const updatedConfigCard = findConfigCard();

      // When remaining turns reaches 0, it resets to MinTurnsBeforeCheck (10)
      expect(updatedConfigCard?.description).toContain("RemainingTurns: 10");
    }
  );

  testWithAiDungeonEnvironment(
    "should not decrement turns when module is disabled",
    () => {
      createConfigCard(`--- Narrative Checklist ---
Enable: false
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`);

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      hooks.onOutput("You continue your adventure.");

      const updatedConfigCard = findConfigCard();

      expect(updatedConfigCard?.description).toContain("RemainingTurns: 5");
    }
  );

  testWithAiDungeonEnvironment(
    "should handle case where no checklist card exists",
    () => {
      createConfigCard(`--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`);

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      const output = "You continue your adventure.";
      const processed = hooks.onOutput(output);

      expect(processed).toBe(output);
    }
  );

  testWithAiDungeonEnvironment("should not modify the output text", () => {
    createConfigCard(`--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
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
    core.registerModule(NarrativeChecklist);

    const hooks = core.createHooks();

    const output = "You find a treasure chest.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  testWithAiDungeonEnvironment(
    "should handle rapid successive outputs without errors",
    () => {
      addHistoryAction("You begin your quest.", "start");

      createConfigCard(`--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 10
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
        checklistCard.description = "[ ] Task 1\n[ ] Task 2\n[ ] Task 3";
      }

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      for (let i = 0; i < 5; i++) {
        const output = `Output number ${i + 1}.`;
        const processed = hooks.onOutput(output);
        expect(processed).toBe(output);

        addHistoryAction(processed, "continue");
      }

      const updatedConfigCard = findConfigCard();

      expect(updatedConfigCard?.description).toContain("RemainingTurns: 5");
    }
  );
});
