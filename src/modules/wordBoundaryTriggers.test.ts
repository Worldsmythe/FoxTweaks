import { describe, it, expect } from "bun:test";
import {
  matchesWordBoundary,
  WordBoundaryTriggers,
  type WordBoundaryTriggersConfig,
} from "./wordBoundaryTriggers";
import { parseContext, getSection } from "../utils/virtualContext";

function createCard(
  id: string,
  options: {
    title?: string;
    keys?: string[];
    entry?: string;
    type?: string;
  } = {}
): StoryCard {
  return {
    id,
    title: options.title,
    keys: options.keys,
    entry: options.entry,
    type: options.type,
  };
}

describe("matchesWordBoundary", () => {
  it("should match exact word", () => {
    expect(matchesWordBoundary("The fox jumped", "fox")).toBe(true);
  });

  it("should match at start of text", () => {
    expect(matchesWordBoundary("Fox is an animal", "Fox")).toBe(true);
  });

  it("should match at end of text", () => {
    expect(matchesWordBoundary("I saw a fox", "fox")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(matchesWordBoundary("The FOX jumped", "fox")).toBe(true);
    expect(matchesWordBoundary("The fox jumped", "FOX")).toBe(true);
  });

  it("should NOT match substring within word", () => {
    expect(matchesWordBoundary("The foxhole was deep", "fox")).toBe(false);
    expect(matchesWordBoundary("Firefox is a browser", "fox")).toBe(false);
  });

  it("should NOT match partial word at start", () => {
    expect(matchesWordBoundary("The firefox browser", "fire")).toBe(false);
  });

  it("should NOT match partial word at end", () => {
    expect(matchesWordBoundary("The bonfire burned", "fire")).toBe(false);
  });

  it("should match word with punctuation boundary", () => {
    expect(matchesWordBoundary("Look, a fox!", "fox")).toBe(true);
    expect(matchesWordBoundary("(fox)", "fox")).toBe(true);
    expect(matchesWordBoundary('"fox"', "fox")).toBe(true);
  });

  it("should match word followed by period", () => {
    expect(matchesWordBoundary("That was a fox.", "fox")).toBe(true);
  });

  it("should match multi-word key", () => {
    expect(matchesWordBoundary("The red fox jumped", "red fox")).toBe(true);
  });

  it("should handle special regex characters in key", () => {
    expect(matchesWordBoundary("Use the sword here", "sword")).toBe(true);
    expect(matchesWordBoundary("The (parenthetical) word", "parenthetical")).toBe(true);
  });

  it("should match empty key at word boundary", () => {
    expect(matchesWordBoundary("Some text", "")).toBe(true);
  });

  it("should handle empty text", () => {
    expect(matchesWordBoundary("", "fox")).toBe(false);
  });
});

describe("WordBoundaryTriggers Config Parsing", () => {
  it("should parse enable config value", () => {
    const config = WordBoundaryTriggers.validateConfig({ enable: true });
    expect(config.enable).toBe(true);
  });

  it("should use false as default for enable", () => {
    const config = WordBoundaryTriggers.validateConfig({});
    expect(config.enable).toBe(false);
  });

  it("should parse string boolean values", () => {
    const config = WordBoundaryTriggers.validateConfig({ enable: "true" });
    expect(config.enable).toBe(true);
  });
});

describe("WordBoundaryTriggers Integration", () => {
  function createHookContext(cards: StoryCard[]) {
    return {
      state: {},
      updateConfig: () => {},
      history: [] as History[],
      storyCards: cards,
      info: { actionCount: 1, characterNames: [] as string[] },
      ai: {
        prompts: [],
        requestPrompt: () => {},
        hasActivePrompt: () => false,
        getResponse: () => null,
        clearResponse: () => {},
      },
    };
  }

  const onContext = WordBoundaryTriggers.hooks.onContext;
  if (!onContext) {
    throw new Error("WordBoundaryTriggers.hooks.onContext is undefined");
  }

  const enabledConfig: WordBoundaryTriggersConfig = {
    enable: true,
  };

  it("should not modify context when disabled", () => {
    const preContext = `### Preamble

World Lore:
### Card Entry

Some content.

Recent Story:
The story mentions fox here.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox"], entry: "### Card Entry\n\nSome content." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const config: WordBoundaryTriggersConfig = { enable: false };
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, config, hookContext);
    const worldLore = getSection(result, "World Lore")?.body;

    expect(worldLore).toContain("Card Entry");
  });

  it("should trigger cards using word boundary matching", () => {
    const preContext = `### Preamble

World Lore:
### Some Native Card

Native content.

Recent Story:
The story mentions the fox running through the forest.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox"], entry: "### Fox Card\n\nFox description." }),
      createCard("2", { title: "Foxhole", keys: ["foxhole"], entry: "### Foxhole\n\nA foxhole description." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).toContain("Fox Card");
    expect(worldLore).not.toContain("Foxhole");
    expect(worldLore).not.toContain("Native content");
  });

  it("should NOT trigger cards on substring matches", () => {
    const preContext = `### Preamble

World Lore:
### Native

Native content.

Recent Story:
Firefox is a great browser and the foxhole was deep.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox"], entry: "### Fox\n\nFox description." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).not.toContain("Fox description");
    expect(worldLore).toBe("");
  });

  it("should trigger cards from preamble text", () => {
    const preContext = `### Character

You are exploring with a fox companion.

World Lore:
### Native Card

Native content.

Recent Story:
The adventure continues.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox"], entry: "### Fox\n\nFox description." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).toContain("Fox description");
  });

  it("should fill available space with multiple cards", () => {
    const preContext = `### Preamble

World Lore:
### Native Card

A very long native card that takes up space.
A very long native card that takes up space.
A very long native card that takes up space.

Recent Story:
The story mentions fox, wolf, bear, eagle, and hawk.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox"], entry: "Fox." }),
      createCard("2", { title: "Wolf", keys: ["wolf"], entry: "Wolf." }),
      createCard("3", { title: "Bear", keys: ["bear"], entry: "Bear." }),
      createCard("4", { title: "Eagle", keys: ["eagle"], entry: "Eagle." }),
      createCard("5", { title: "Hawk", keys: ["hawk"], entry: "Hawk." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    expect(result.worldLoreCards.length).toBe(5);
  });

  it("should not exceed original World Lore space", () => {
    const preContext = `### Preamble

World Lore:
Short.

Recent Story:
The story mentions fox.`;

    const cards = [
      createCard("1", {
        title: "Fox",
        keys: ["fox"],
        entry: "This is a very long entry that would exceed the original space.",
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).not.toContain("very long entry");
  });

  it("should skip config cards", () => {
    const preContext = `### Preamble

World Lore:
### Some Card

Card content here.

Recent Story:
The story mentions FoxTweaks Config.`;

    const cards = [
      createCard("1", {
        title: "FoxTweaks Config",
        keys: ["FoxTweaks Config"],
        entry: "Config card.",
        type: "class",
      }),
      createCard("2", { title: "Regular", keys: ["Regular"], entry: "Regular card." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    expect(result.worldLoreCards.some((c) => c.title === "FoxTweaks Config")).toBe(false);
  });

  it("should clear worldLoreCards and repopulate", () => {
    const preContext = `### Preamble

World Lore:
### Original Card

Original content.

Recent Story:
Story with fox and wolf.`;

    const originalCard = createCard("orig", {
      title: "Original",
      keys: ["original"],
      entry: "### Original Card\n\nOriginal content.",
    });
    const foxCard = createCard("1", { title: "Fox", keys: ["fox"], entry: "Fox entry." });
    const wolfCard = createCard("2", { title: "Wolf", keys: ["wolf"], entry: "Wolf entry." });

    const ctx = parseContext(preContext, [originalCard], 10000);
    const hookContext = createHookContext([originalCard, foxCard, wolfCard]);

    const result = onContext(ctx, enabledConfig, hookContext);

    expect(result.worldLoreCards.some((c) => c.id === "orig")).toBe(false);
    expect(result.worldLoreCards.some((c) => c.id === "1")).toBe(true);
    expect(result.worldLoreCards.some((c) => c.id === "2")).toBe(true);
  });

  it("should match keys case-insensitively", () => {
    const preContext = `### Preamble

World Lore:
### Native

Native content.

Recent Story:
The SARI appeared.`;

    const cards = [
      createCard("1", { title: "Sari", keys: ["sari"], entry: "Sari description." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).toContain("Sari description");
  });

  it("should skip cards without keys", () => {
    const preContext = `### Preamble

World Lore:
### Native

Native content.

Recent Story:
Some story text.`;

    const cards = [
      createCard("1", { title: "NoKeys", entry: "No keys card." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);

    expect(result.worldLoreCards.length).toBe(0);
  });

  it("should skip cards without entry", () => {
    const preContext = `### Preamble

World Lore:
### Native

Native content.

Recent Story:
The fox appeared.`;

    const cards = [createCard("1", { title: "Fox", keys: ["fox"] })];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);

    expect(result.worldLoreCards.length).toBe(0);
  });

  it("should trigger on first matching key only", () => {
    const preContext = `### Preamble

World Lore:
### Native Card

Native content here that is long enough.

Recent Story:
The fox and the vixen appeared together.`;

    const cards = [
      createCard("1", { title: "Fox", keys: ["fox", "vixen"], entry: "Fox entry." }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const hookContext = createHookContext(cards);

    const result = onContext(ctx, enabledConfig, hookContext);

    expect(result.worldLoreCards.length).toBe(1);
    expect(result.worldLoreCards[0]?.id).toBe("1");
  });
});
