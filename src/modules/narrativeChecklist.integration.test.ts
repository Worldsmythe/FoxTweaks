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
MaxTurnsBeforeCheck: 10
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
MaxTurnsBeforeCheck: 10
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
      addHistoryAction("First output.", "continue");
      hooks.onOutput("Second output.");
      addHistoryAction("Second output.", "continue");
      hooks.onOutput("Third output.");
      addHistoryAction("Third output.", "continue");

      const updatedConfigCard = findConfigCard();

      // When remaining turns reaches 0, it stays at 0 until boundary exits context
      expect(updatedConfigCard?.description).toContain("RemainingTurns: 0");
    }
  );

  testWithAiDungeonEnvironment(
    "should not decrement turns when module is disabled",
    () => {
      createConfigCard(`--- Narrative Checklist ---
Enable: false
MaxTurnsBeforeCheck: 10
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
MaxTurnsBeforeCheck: 10
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
MaxTurnsBeforeCheck: 10
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
MaxTurnsBeforeCheck: 10
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

  testWithAiDungeonEnvironment(
    "should detect when boundary action exits context and trigger check",
    () => {
      addHistoryAction("You begin your quest in the ancient forest.", "start");
      addHistoryAction("You walk deeper into the woods.", "continue");
      addHistoryAction("A mysterious figure appears before you.", "continue");

      createConfigCard(`--- Narrative Checklist ---
Enable: true
MaxTurnsBeforeCheck: 3
RemainingTurns: 1
AlwaysIncludeInContext: true
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
        checklistCard.entry = "- [ ] Meet the mysterious figure\n- [ ] Find the ancient artifact";
      }

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      info.actionCount = 4;
      hooks.onOutput("You meet the figure.");
      addHistoryAction("You meet the figure.", "continue");

      let configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: 0");

      const contextWithBoundary = `Recent Story:\nYou begin your quest in the ancient forest.\nYou walk deeper into the woods.\nA mysterious figure appears before you.\nYou meet the figure.`;
      hooks.reformatContext(contextWithBoundary);

      info.actionCount = 5;
      hooks.onOutput("The figure speaks to you.");
      addHistoryAction("The figure speaks to you.", "continue");

      configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: -1");

      info.actionCount = 6;
      const contextWithoutBoundary = `Recent Story:\nYou meet the figure.\nThe figure speaks to you.\nYou listen carefully.`;
      hooks.reformatContext(contextWithoutBoundary);

      info.actionCount = 7;
      hooks.onOutput("You listen carefully.");
      addHistoryAction("You listen carefully.", "continue");

      configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: 2");
    }
  );

  testWithAiDungeonEnvironment(
    "should not trigger check if boundary still in context",
    () => {
      addHistoryAction("You enter the dungeon.", "start");
      addHistoryAction("You explore the first room.", "continue");

      createConfigCard(`--- Narrative Checklist ---
Enable: true
MaxTurnsBeforeCheck: 5
RemainingTurns: 1
AlwaysIncludeInContext: true
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
        checklistCard.entry = "- [ ] Find the key";
      }

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      info.actionCount = 3;
      hooks.onOutput("You find a door.");
      addHistoryAction("You find a door.", "continue");

      let configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: 0");

      const contextWithBoundary = `Recent Story:\nYou enter the dungeon.\nYou explore the first room.\nYou find a door.`;
      hooks.reformatContext(contextWithBoundary);

      info.actionCount = 4;
      hooks.onOutput("You examine the door.");

      configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: -1");
    }
  );

  testWithAiDungeonEnvironment(
    "should respect action count when boundary exits to prevent premature checking on edits",
    () => {
      addHistoryAction("Action 1", "continue");
      addHistoryAction("Action 2", "continue");

      createConfigCard(`--- Narrative Checklist ---
Enable: true
MaxTurnsBeforeCheck: 5
RemainingTurns: 1
AlwaysIncludeInContext: true
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
        checklistCard.entry = "- [ ] Task A\n- [ ] Task B";
      }

      const core = new FoxTweaks();
      core.registerModule(NarrativeChecklist);

      const hooks = core.createHooks();

      info.actionCount = 100;
      hooks.onOutput("Output that reaches 0.");
      addHistoryAction("Output that reaches 0.", "continue");

      let configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: 0");

      info.actionCount = 101;
      hooks.reformatContext("Recent Story:\nSome text without boundary.");

      hooks.onOutput("Output after 1 action - not enough progress yet.");

      configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: -1");

      info.actionCount = 102;
      hooks.reformatContext("Recent Story:\nSome text without boundary.");

      hooks.onOutput("Output after 2 actions - triggers because MIN is effectively 2.");

      configCard = findConfigCard();
      expect(configCard?.description).toContain("RemainingTurns: 4");
    }
  );
});
