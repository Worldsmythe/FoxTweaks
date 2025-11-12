import { describe, expect } from "bun:test";
import { FoxTweaks } from "./core";
import { BetterYou } from "./modules/betteryou";
import {
  testWithAiDungeonEnvironment,
  createConfigCard,
  addHistoryAction,
} from "./test-utils";
import { findConfigCard } from "./utils/storyCardHelpers";

describe("Test Utils Examples", () => {
  testWithAiDungeonEnvironment("demonstrates basic usage", () => {
    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    createConfigCard(
      `--- Better You ---
Enable: true
Replacements:
  me: you
Patterns: {}`
    );

    addHistoryAction("You enter the room.", "do");
    addHistoryAction("The room is dark.", "continue");

    const hooks = core.createHooks();
    const processed = hooks.onInput("> You look at me.");

    expect(processed).toContain("you");
    expect(processed).not.toMatch(/\bme\b/);
  });

  testWithAiDungeonEnvironment("demonstrates config card helpers", () => {
    createConfigCard(
      `--- Better You ---
Enable: false`
    );

    const configCard = findConfigCard();
    expect(configCard).toBeDefined();
    expect(configCard?.title).toBe("FoxTweaks Config");
    expect(configCard?.description).toContain("Enable: false");
  });

  testWithAiDungeonEnvironment("demonstrates history helpers", () => {
    addHistoryAction("Game starts", "start");
    addHistoryAction("You look around", "do");
    addHistoryAction("You see a forest", "continue");

    expect(history.length).toBe(3);
    expect(history[0]?.type).toBe("start");
    expect(history[2]?.type).toBe("continue");
  });
});
