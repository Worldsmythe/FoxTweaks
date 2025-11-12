import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { BetterYou } from "./betteryou";
import { testWithAiDungeonEnvironment, createConfigCard } from "../test-utils";

describe("BetterYou Module - Integration Tests", () => {
  testWithAiDungeonEnvironment("should replace me/mine with you/yours in player input", () => {
    createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = "> You look at me in the mirror and think about mine past.";
    const processed = hooks.onInput(input);

    expect(processed).toContain("you");
    expect(processed).toContain("yours");
    expect(processed).not.toMatch(/\bme\b/);
    expect(processed).not.toMatch(/\bmine\b/);
  });

  testWithAiDungeonEnvironment("should not modify input when disabled", () => {
    createConfigCard(`--- Better You ---
Enable: false
Replacements:
  me: you`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = "> You look at me.";
    const processed = hooks.onInput(input);

    expect(processed).toBe(input);
  });

  testWithAiDungeonEnvironment("should only process lines starting with '> You'", () => {
    createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = "me picked up mine sword.";
    const processed = hooks.onInput(input);

    expect(processed).toBe(input);
  });

  testWithAiDungeonEnvironment("should handle dialogue lines starting with '> \"'", () => {
    createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = '> "Help me!" you shout.';
    const processed = hooks.onInput(input);

    expect(processed).toContain("me");
  });

  testWithAiDungeonEnvironment("should handle capitalization replacements with punctuation (. you -> . You)", () => {
    createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours
Patterns:
  . you: . You
  ." you: ." You`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = '> You tell me the story. you listen carefully. "That\'s interesting." you say.';
    const processed = hooks.onInput(input);

    expect(processed).toContain(". You listen");
    expect(processed).toContain('." You say');
    expect(processed).not.toContain(". you");
    expect(processed).not.toContain('." you');
  });

  testWithAiDungeonEnvironment("should chain replacements correctly (regression test)", () => {
    createConfigCard(`--- Better You ---
Enable: true
Replacements:
  me: you
  you: them`);

    const core = new FoxTweaks();
    core.registerModule(BetterYou);

    const hooks = core.createHooks();

    const input = "> You see me standing there.";
    const processed = hooks.onInput(input);

    expect(processed).toContain("them");
    expect(processed).not.toContain("me");
  });
});
