import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { DebugStart, DebugEnd } from "./debug";
import { BetterYou } from "./betteryou";
import { Redundancy } from "./redundancy";
import { testWithAiDungeonEnvironment } from "../test-utils";

describe("Debug Module - Integration Tests", () => {
  testWithAiDungeonEnvironment("should create debug cards when enabled", () => {
    history = [];
    const core = new FoxTweaks();
    core.registerModule(DebugStart);
    core.registerModule(BetterYou);
    core.registerModule(DebugEnd);

    const configCard: StoryCard = {
      id: "0",
      title: "FoxTweaks Config",
      keys: ["Configure FoxTweaks behavior"],
      description: `--- Debug ---
EnableDebugCards: true

--- Better You ---
Enable: true
Replacements:
  my: your
  me: you`,
      type: "class",
      entry: "",
    };
    storyCards = [configCard];

    const hooks = core.createHooks();

    const inputText = "> You grab my sword.";
    const result = hooks.onInput(inputText);

    expect(result).toBe("> You grab your sword.");

    const debugCard = storyCards.find((c) => c.type === "debug_input");
    expect(debugCard).toBeDefined();
    expect(debugCard?.title).toBe("Input Debug");
    expect(debugCard?.entry).toContain("Original input text:");
    expect(debugCard?.entry).toContain("> You grab my sword.");
    expect(debugCard?.entry).toContain("Resulting input text:");
    expect(debugCard?.entry).toContain("> You grab your sword.");
    expect(debugCard?.entry).toContain("Changed: Yes");
  });

  testWithAiDungeonEnvironment(
    "should not create debug cards when disabled",
    () => {
      history = [];
      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(BetterYou);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: false

--- Better You ---
Enable: true
Replacements:
  my: your
  me: you`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const inputText = "> You grab my sword.";
      hooks.onInput(inputText);

      const debugCard = storyCards.find((c) => c.type === "debug_input");
      expect(debugCard).toBeUndefined();
    }
  );

  testWithAiDungeonEnvironment(
    "should show 'Changed: No' when text is not modified",
    () => {
      history = [];
      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(BetterYou);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true

--- Better You ---
Enable: false`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const inputText = "> You grab the sword.";
      hooks.onInput(inputText);

      const debugCard = storyCards.find((c) => c.type === "debug_input");
      expect(debugCard).toBeDefined();
      expect(debugCard?.entry).toContain("Changed: No");
    }
  );

  testWithAiDungeonEnvironment(
    "should create debug cards for all three hooks",
    () => {
      const initialHistory: History[] = [
        { text: "You enter the room.", type: "do" },
        {
          text: "You see a wooden door. It has strange markings.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(BetterYou);
      core.registerModule(Redundancy);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true

--- Better You ---
Enable: true
Replacements:
  my: your
  me: you

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const inputText = "> You grab my sword.";
      hooks.onInput(inputText);

      const contextText =
        "Memory: You are a warrior.\n\nRecent story:\nYou grab your sword.";
      hooks.onContext(contextText);

      const outputText = "It has strange markings. The markings glow faintly.";
      hooks.onOutput(outputText);

      const inputDebugCard = storyCards.find((c) => c.type === "debug_input");
      expect(inputDebugCard).toBeDefined();
      expect(inputDebugCard?.title).toBe("Input Debug");

      const contextDebugCard = storyCards.find(
        (c) => c.type === "debug_context"
      );
      expect(contextDebugCard).toBeDefined();
      expect(contextDebugCard?.title).toBe("Context Debug");

      const outputDebugCard = storyCards.find((c) => c.type === "debug_output");
      expect(outputDebugCard).toBeDefined();
      expect(outputDebugCard?.title).toBe("Output Debug");
    }
  );

  testWithAiDungeonEnvironment(
    "should update existing debug cards on successive calls",
    () => {
      history = [];
      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(BetterYou);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true

--- Better You ---
Enable: true
Replacements:
  my: your
  me: you`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      hooks.onInput("> You grab my sword.");

      const firstDebugCard = storyCards.find((c) => c.type === "debug_input");
      expect(firstDebugCard).toBeDefined();
      expect(firstDebugCard?.entry).toContain("my sword");

      const initialCardCount = storyCards.length;

      hooks.onInput("> You take my shield.");

      const secondDebugCard = storyCards.find((c) => c.type === "debug_input");
      expect(secondDebugCard).toBeDefined();
      expect(secondDebugCard?.entry).toContain("my shield");
      expect(secondDebugCard?.entry).not.toContain("my sword");

      expect(storyCards.length).toBe(initialCardCount);
    }
  );

  testWithAiDungeonEnvironment(
    "should show redundancy removal in output debug card",
    () => {
      const initialHistory: History[] = [
        { text: "You approach the door.", type: "do" },
        {
          text: "You see a wooden door. It has strange markings.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(Redundancy);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const overlappingOutput =
        "It has strange markings. The markings glow faintly in the dark.";
      hooks.onOutput(overlappingOutput);

      const outputDebugCard = storyCards.find((c) => c.type === "debug_output");
      expect(outputDebugCard).toBeDefined();
      expect(outputDebugCard?.entry).toContain("Original output text:");
      expect(outputDebugCard?.entry).toContain("It has strange markings");
      expect(outputDebugCard?.entry).toContain("Resulting output text:");
      expect(outputDebugCard?.entry).toContain(
        "The markings glow faintly in the dark."
      );
      expect(outputDebugCard?.entry).not.toContain(
        "Resulting output text:\n```\nIt has strange markings"
      );
      expect(outputDebugCard?.entry).toContain("Changed: Yes");
    }
  );

  testWithAiDungeonEnvironment(
    "should show (empty) for empty resulting text",
    () => {
      history = [];
      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const inputText = "Regular text without the > You prefix.";
      hooks.onInput(inputText);

      const debugCard = storyCards.find((c) => c.type === "debug_input");
      expect(debugCard).toBeDefined();
      expect(debugCard?.entry).toContain("Regular text without the > You prefix");
      expect(debugCard?.entry).toContain("Changed: No");
    }
  );

  testWithAiDungeonEnvironment(
    "should clean up temporary cards after processing",
    () => {
      history = [];
      const core = new FoxTweaks();
      core.registerModule(DebugStart);
      core.registerModule(BetterYou);
      core.registerModule(DebugEnd);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Debug ---
EnableDebugCards: true

--- Better You ---
Enable: true
Replacements:
  my: your
  me: you`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      hooks.onInput("> You grab my sword.");

      const tempCard = storyCards.find((c) => c.type === "debug_temp_input");
      expect(tempCard).toBeUndefined();

      const debugCard = storyCards.find((c) => c.type === "debug_input");
      expect(debugCard).toBeDefined();
    }
  );
});
