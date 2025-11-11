import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "../core";
import { BetterYou } from "./betteryou";

describe("BetterYou Module - Integration Tests", () => {
  beforeEach(() => {
    (globalThis as any).log = () => {};
    (globalThis as any).storyCards = [];
    (globalThis as any).state = {};
    (globalThis as any).info = {};
    (globalThis as any).history = [];
    (globalThis as any).addStoryCard = () => {};
  });

  test("should replace me/mine with you/yours in player input", () => {
    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const input = "> You look at me in the mirror and think about mine past.";
    const processed = hooks.onInput(input);

    expect(processed).toContain("you");
    expect(processed).toContain("yours");
    expect(processed).not.toMatch(/\bme\b/);
    expect(processed).not.toMatch(/\bmine\b/);
  });

  test("should not modify input when disabled", () => {
    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: false
Replacements:
  me: you`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const input = "> You look at me.";
    const processed = hooks.onInput(input);

    expect(processed).toBe(input);
  });

  test("should only process lines starting with '> You'", () => {
    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const input = "me picked up mine sword.";
    const processed = hooks.onInput(input);

    expect(processed).toBe(input);
  });

  test("should handle dialogue lines starting with '> \"'", () => {
    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Better You ---
Enable: true
Replacements:
  me: you`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const input = '> "Help me!" you shout.';
    const processed = hooks.onInput(input);

    expect(processed).toContain("me");
  });
});
