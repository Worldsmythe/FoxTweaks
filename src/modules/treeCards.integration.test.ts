import { parseContext, getSection } from "../utils/virtualContext";
import { describe, it, expect } from "bun:test";
import { TreeCards } from "./treeCards";

import type { TreeCardsConfig } from "./treeCards";

const integrationPreContext = `### Character

You are James. You are James, an adventurer. You have black hair and blue eyes. You're fit. Your class is Warrior. Your adventuring companion is Sari, a foxkin rogue.

### Premise

This is a world with fantasy races: elves, halflings, fairies, beastkin, deathwalkers, vampires, and dragons to name a few.

You're exploring a dungeon with Sari.

World Lore:
### Sari

Sari is a [[fox]] rogue. She has russet fur and auburn hair. She's athletic and dexterous.

Recent Story:
{Note: Begin a story according to the premise information, if any is given.}

The air in the dungeon is thick with the smell of damp stone and something metallic—old blood, maybe. Your torch casts flickering shadows that dance along the moss-slick walls like nervous ghosts. Every drip of water from the ceiling echoes like a tiny hammer strike.

Beside you, Sari's ears twitch, swiveling toward a faint scraping sound ahead. Her tail gives a single, sharp flick—her version of a raised eyebrow. "Trap."

[Author's note: Writing Style: snappy, energetic, detailed, descriptive, exaggerated, indulgent.
Perspective: Second Person Present from James's point of view.]

Continue From:
You freeze mid-step, boot hovering over a suspiciously smooth flagstone. Sari's never wrong about these things; not when her whiskers do that twitchy thing and her claws extend just enough to click against the stone floor.

"Pressure plate?" you whisper, easing your weight back onto your heel.

She crouches low, nose almost brushing the ground as she creeps forward.`;

const integrationCards: StoryCard[] = [
  {
    id: "1",
    keys: ["Sari"],
    entry:
      "Sari is a [[fox]] rogue. She has russet fur and auburn hair. She's athletic and dexterous.",
    type: "character",
    title: "Sari",
    description: "",
  },
  {
    id: "2",
    keys: ["fox", "Fox"],
    entry:
      "### Foxes\n\nFoxes or sometimes 'foxkin' are a type of [[beastkin]] that look like attractive humans standing 4'6\" to 6'0\".  Long-legged, generally athletic folk. Pointed, fox-like ears. \"Wild\" hair colors like red, white, or silver. Sharp and cunning eyes, and natural grace.\n\n------",
    type: "race",
    title: "Foxes",
    description: "",
  },
  {
    id: "3",
    keys: ["wolf", "Wolf"],
    entry:
      "### Wolves\n\nWolves or sometimes 'wolfkin' are a type of [[beastkin]] that look like attractive humans standing 4'6\" to 6'0\".  Long-legged, generally athletic folk. Pointed, wolf-like ears. \"Wild\" hair colors like red, white, or silver. Sharp and cunning eyes, and natural grace.\n\n------",
    type: "race",
    title: "Wolves",
    description: "",
  },
  {
    id: "4",
    keys: ["beastkin", "Beastkin"],
    entry:
      "### Beastkin\n\nBeastkin or just 'Kin' are humanoids with specific animal features: usually ears, tails, and some aspects of physiques. Other features (hands, skin, faces) are human otherwise. They tend to live in larger, extended-family units or homesteads.\n\n------",
    type: "race",
    title: "Beastkin",
    description: "",
  },
];

describe("TreeCards Integration", () => {
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

  const onContext = TreeCards.hooks.onContext;
  if (!onContext) {
    throw new Error("TreeCards.hooks.onContext is undefined");
  }

  it("should inject linked cards and strip all wikilinks", () => {
    const ctx = parseContext(integrationPreContext, integrationCards, 10000);
    const config = TreeCards.validateConfig({ enable: "true" });
    const hookContext = createHookContext(integrationCards);

    const result = onContext(ctx, config, hookContext);
    const worldLore = getSection(result, "World Lore")?.body;

    expect(worldLore).toBeDefined();

    expect(worldLore).toContain("Sari is a fox rogue");
    expect(worldLore).not.toContain("[[fox]]");

    expect(worldLore).toContain("### Foxes");
    expect(worldLore).toContain("type of beastkin");
    expect(worldLore).not.toContain("[[beastkin]]");

    expect(worldLore).toContain("### Beastkin");
    expect(worldLore).toContain("Beastkin or just 'Kin'");

    expect(worldLore).not.toContain("[[");
    expect(worldLore).not.toContain("]]");
  });

  it("should order dependencies before dependents", () => {
    const ctx = parseContext(integrationPreContext, integrationCards, 10000);
    const config = TreeCards.validateConfig({ enable: "true" });
    const hookContext = createHookContext(integrationCards);

    const result = onContext(ctx, config, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    const beastkinIndex = worldLore.indexOf("### Beastkin");
    const foxesIndex = worldLore.indexOf("### Foxes");

    expect(beastkinIndex).toBeGreaterThan(-1);
    expect(foxesIndex).toBeGreaterThan(-1);
    expect(beastkinIndex).toBeLessThan(foxesIndex);
  });

  it("should not include unrelated cards (Wolves)", () => {
    const ctx = parseContext(integrationPreContext, integrationCards, 10000);
    const config = TreeCards.validateConfig({ enable: "true" });
    const hookContext = createHookContext(integrationCards);

    const result = onContext(ctx, config, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).not.toContain("### Wolves");
  });

  it("should preserve preamble and other sections", () => {
    const ctx = parseContext(integrationPreContext, integrationCards, 10000);
    const config = TreeCards.validateConfig({ enable: "true" });
    const hookContext = createHookContext(integrationCards);

    const result = onContext(ctx, config, hookContext);

    expect(result.preamble).toContain("### Character");
    expect(result.preamble).toContain("You are James");

    const recentStory = getSection(result, "Recent Story")?.body;
    expect(recentStory).toContain("The air in the dungeon");

    const authorsNote = getSection(result, "Author's Note")?.body;
    expect(authorsNote).toContain("Writing Style: snappy");
  });

  it("should not modify context when disabled", () => {
    const ctx = parseContext(integrationPreContext, integrationCards, 10000);
    const config = TreeCards.validateConfig({ enable: "false" });
    const hookContext = createHookContext(integrationCards);

    const result = onContext(ctx, config, hookContext);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).toContain("[[fox]]");
    expect(worldLore).not.toContain("### Foxes");
    expect(worldLore).not.toContain("### Beastkin");
  });

});
