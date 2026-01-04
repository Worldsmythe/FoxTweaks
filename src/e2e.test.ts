import { describe, expect } from "bun:test";
import { FoxTweaks as FoxTweaksCore } from "./core";
import { DiceRoll } from "./modules/diceroll";
import { Interject } from "./modules/interject";
import { TreeCards } from "./modules/treeCards";
import { SectionInjection } from "./modules/sectionInjection";
import { Paragraph } from "./modules/paragraph";
import { Redundancy } from "./modules/redundancy";
import { BetterYou } from "./modules/betteryou";
import { Context } from "./modules/context";
import { NarrativeChecklist } from "./modules/narrativeChecklist";
import { DebugStart, DebugEnd } from "./modules/debug";
import {
  testWithAiDungeonEnvironment,
  createConfigCard,
  addHistoryAction,
} from "./test-utils";
import { findStoryCard } from "./utils/storyCardHelpers";

function createFoxTweaks() {
  const core = new FoxTweaksCore();
  core.registerModule(DebugStart);
  core.registerModule(DiceRoll);
  core.registerModule(Interject);
  core.registerModule(TreeCards);
  core.registerModule(SectionInjection);
  core.registerModule(Paragraph);
  core.registerModule(Redundancy);
  core.registerModule(BetterYou);
  core.registerModule(NarrativeChecklist);
  core.registerModule(Context);
  core.registerModule(DebugEnd);
  return core.createHooks();
}

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

function setupIntegrationCards(): void {
  const sari = globalThis.addStoryCard(
    "Sari",
    "Sari is a [[fox]] rogue. She has russet fur and auburn hair. She's athletic and dexterous.",
    "character",
    "Sari",
    "",
    { returnCard: true }
  );
  if (sari && typeof sari !== "number") {
    sari.keys = ["Sari"];
  }

  const fox = globalThis.addStoryCard(
    "fox",
    "### Foxes\n\nFoxes or sometimes 'foxkin' are a type of [[beastkin]] that look like attractive humans standing 4'6\" to 6'0\".  Long-legged, generally athletic folk. Pointed, fox-like ears. \"Wild\" hair colors like red, white, or silver. Sharp and cunning eyes, and natural grace.\n\n------",
    "race",
    "Foxes",
    "",
    { returnCard: true }
  );
  if (fox && typeof fox !== "number") {
    fox.keys = ["fox", "Fox"];
  }

  const wolf = globalThis.addStoryCard(
    "wolf",
    "### Wolves\n\nWolves or sometimes 'wolfkin' are a type of [[beastkin]] that look like attractive humans standing 4'6\" to 6'0\".  Long-legged, generally athletic folk. Pointed, wolf-like ears. \"Wild\" hair colors like red, white, or silver. Sharp and cunning eyes, and natural grace.\n\n------",
    "race",
    "Wolves",
    "",
    { returnCard: true }
  );
  if (wolf && typeof wolf !== "number") {
    wolf.keys = ["wolf", "Wolf"];
  }

  const beastkin = globalThis.addStoryCard(
    "beastkin",
    "### Beastkin\n\nBeastkin or just 'Kin' are humanoids with specific animal features: usually ears, tails, and some aspects of physiques. Other features (hands, skin, faces) are human otherwise. They tend to live in larger, extended-family units or homesteads.\n\n------",
    "race",
    "Beastkin",
    "",
    { returnCard: true }
  );
  if (beastkin && typeof beastkin !== "number") {
    beastkin.keys = ["beastkin", "Beastkin"];
  }
}

function setupInjectionCards(): void {
  const preambleCard = globalThis.addStoryCard(
    "preamble-card",
    '<inject section="preamble" />This is injected to preamble.',
    "lore",
    "Preamble Card",
    "",
    { returnCard: true }
  );
  if (preambleCard && typeof preambleCard !== "number") {
    preambleCard.keys = ["preamble-card"];
  }

  const memoriesCard = globalThis.addStoryCard(
    "memories-card",
    '<inject section="Memories" />This is injected to memories section.',
    "lore",
    "Memories Card",
    "",
    { returnCard: true }
  );
  if (memoriesCard && typeof memoriesCard !== "number") {
    memoriesCard.keys = ["memories-card"];
  }

  const triggerCard = globalThis.addStoryCard(
    "trigger-card",
    "References [[preamble-card]] and [[memories-card]].",
    "trigger",
    "Trigger Card",
    "",
    { returnCard: true }
  );
  if (triggerCard && typeof triggerCard !== "number") {
    triggerCard.keys = ["trigger-card"];
  }
}

describe("FoxTweaks E2E - Full Library Integration", () => {
  testWithAiDungeonEnvironment(
    "should process context through all modules with TreeCards enabled",
    () => {
      setupIntegrationCards();

      const configCard = createConfigCard(`--- Debug ---
EnableDebugCards: true

--- Dice Roll ---
Enable: false

--- Interject ---
Enable: false

--- Word Boundary Triggers ---
Enable: false

--- Tree Cards ---
Enable: true
LinkPercentage: 30
ImplicitLinks: false
MaxDepth: 3
MinSentences: 5

--- Section Injection ---
Enable: true

--- Paragraph ---
Enable: false

--- Redundancy ---
Enable: false

--- Better You ---
Enable: false

--- Narrative Checklist ---
Enable: false

--- Context ---
Enable: false`);

      addHistoryAction("You begin exploring the dungeon.", "start");

      globalThis.info = {
        actionCount: 1,
        characterNames: ["James"],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(integrationPreContext);

      expect(result).toContain("### Foxes");
      expect(result).toContain("### Beastkin");
      expect(result).not.toContain("### Wolves");

      expect(result).not.toContain("[[fox]]");
      expect(result).not.toContain("[[beastkin]]");
      expect(result).not.toContain("[[");
      expect(result).not.toContain("]]");

      expect(result).toContain("Sari is a fox rogue");
      expect(result).toContain("type of beastkin");

      const beastkinIndex = result.indexOf("### Beastkin");
      const foxesIndex = result.indexOf("### Foxes");
      expect(beastkinIndex).toBeLessThan(foxesIndex);
    }
  );

  testWithAiDungeonEnvironment(
    "should create debug cards showing context transformations",
    () => {
      setupIntegrationCards();

      createConfigCard(`--- Debug ---
EnableDebugCards: true

--- Tree Cards ---
Enable: true

--- Context ---
Enable: false`);

      globalThis.info = {
        actionCount: 1,
        characterNames: ["James"],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      hooks.onContext(integrationPreContext);

      const contextDebugCard = findStoryCard((c) => c.type === "debug_context");
      expect(contextDebugCard).toBeDefined();
      expect(contextDebugCard?.entry).toContain("Original context text:");
      expect(contextDebugCard?.entry).toContain("Resulting context text:");
    }
  );

  testWithAiDungeonEnvironment(
    "should inject cards to targeted sections via injection markers",
    () => {
      const preambleCard = globalThis.addStoryCard(
        "preamble-card",
        '<inject section="preamble" />This content goes to preamble.',
        "lore",
        "Preamble Card",
        "",
        { returnCard: true }
      );
      if (preambleCard && typeof preambleCard !== "number") {
        preambleCard.keys = ["preamble-card"];
      }

      const memoriesCard = globalThis.addStoryCard(
        "memories-card",
        '<inject section="Memories" />This content goes to memories.',
        "lore",
        "Memories Card",
        "",
        { returnCard: true }
      );
      if (memoriesCard && typeof memoriesCard !== "number") {
        memoriesCard.keys = ["memories-card"];
      }

      const triggerCard = globalThis.addStoryCard(
        "trigger-main",
        "Main trigger that links to [[preamble-card]] and [[memories-card]].",
        "trigger",
        "Trigger Card",
        "",
        { returnCard: true }
      );
      if (triggerCard && typeof triggerCard !== "number") {
        triggerCard.keys = ["trigger-main"];
      }

      const contextWithTrigger = `### Preamble Text

World Lore:
Main trigger that links to [[preamble-card]] and [[memories-card]].

Memories:
Some existing memories.

Recent Story:
The story continues.

[Author's note: Be creative.]`;

      createConfigCard(`--- Debug ---
EnableDebugCards: false

--- Tree Cards ---
Enable: true
LinkPercentage: 50
MaxDepth: 3

--- Section Injection ---
Enable: true`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(contextWithTrigger);

      expect(result).toContain("This content goes to preamble.");

      const preambleEnd = result.indexOf("World Lore:");
      const preambleInjection = result.indexOf(
        "This content goes to preamble."
      );
      expect(preambleInjection).toBeLessThan(preambleEnd);

      expect(result).toContain("This content goes to memories.");

      expect(result).not.toContain("<inject");
      expect(result).not.toContain('section="');
    }
  );

  testWithAiDungeonEnvironment(
    "should apply markdown formatting when Context module is enabled",
    () => {
      setupIntegrationCards();

      createConfigCard(`--- Debug ---
EnableDebugCards: false

--- Tree Cards ---
Enable: true

--- Context ---
Enable: true
HeaderFormat: markdown
MarkdownLevel: ##
AuthorsNoteFormat: markdown`);

      globalThis.info = {
        actionCount: 1,
        characterNames: ["James"],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(integrationPreContext);

      expect(result).toContain("## World Lore");
      expect(result).toContain("## Recent Story");
      expect(result).toContain("## Author's Note:");
      expect(result).not.toContain("[Author's note:");
    }
  );

  testWithAiDungeonEnvironment(
    "should add interject message to postamble when Interject is enabled",
    () => {
      const configCard = createConfigCard(`--- Debug ---
EnableDebugCards: false

--- Interject ---
Enable: true
MaxTurns: 3
RemainingTurns: 0

--- Tree Cards ---
Enable: false

--- Context ---
Enable: false`);

      configCard.entry = `Type something here to emphasize it to the AI:

Focus on describing the environment in detail.`;

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const simpleContext = `World Lore:
Some lore.

Recent Story:
The story.

[Author's note: Be creative.]

Continue From:
You continue forward.`;

      const hooks = createFoxTweaks();
      const result = hooks.onContext(simpleContext);

      expect(result).toContain("<SYSTEM MESSAGE>");
      expect(result).toContain(
        "Focus on describing the environment in detail."
      );
      expect(result).toContain("</SYSTEM MESSAGE>");

      const systemMessageIndex = result.indexOf("<SYSTEM MESSAGE>");
      const continueFromIndex = result.indexOf("Continue From:");
      expect(systemMessageIndex).toBeGreaterThan(continueFromIndex);
    }
  );

  testWithAiDungeonEnvironment(
    "should process all modules together without conflicts",
    () => {
      setupIntegrationCards();

      const configCard = createConfigCard(`--- Debug ---
EnableDebugCards: true

--- Interject ---
Enable: true
MaxTurns: 3
RemainingTurns: 0

--- Word Boundary Triggers ---
Enable: false

--- Tree Cards ---
Enable: true
LinkPercentage: 30

--- Section Injection ---
Enable: true

--- Context ---
Enable: true
HeaderFormat: markdown
MarkdownLevel: ##
AuthorsNoteFormat: bracket`);

      configCard.entry = `Type something here to emphasize it to the AI:

Remember Sari's fox-like agility.`;

      globalThis.info = {
        actionCount: 5,
        characterNames: ["James"],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(integrationPreContext);

      expect(result).toContain("## World Lore");
      expect(result).toContain("## Recent Story");

      expect(result).toContain("### Foxes");
      expect(result).toContain("### Beastkin");
      expect(result).not.toContain("[[");

      expect(result).toContain("<SYSTEM MESSAGE>");
      expect(result).toContain("Remember Sari's fox-like agility.");

      const beastkinIndex = result.indexOf("### Beastkin");
      const foxesIndex = result.indexOf("### Foxes");
      expect(beastkinIndex).toBeLessThan(foxesIndex);

      const debugCard = findStoryCard((c) => c.type === "debug_context");
      expect(debugCard).toBeDefined();
      expect(debugCard?.entry).toContain("Changed: Yes");
    }
  );

  testWithAiDungeonEnvironment(
    "should maintain correct section order in serialized context",
    () => {
      createConfigCard(`--- Tree Cards ---
Enable: false

--- Context ---
Enable: true
HeaderFormat: markdown
MarkdownLevel: ##
AuthorsNoteFormat: markdown`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const fullContext = `Preamble text here.

World Lore:
World lore content.

Story Summary:
Summary content.

Memories:
Memory content.

Narrative Checklist:
Checklist content.

Recent Story:
Recent story content.

[Author's note: Note content.]

Continue From:
Postamble content.`;

      const hooks = createFoxTweaks();
      const result = hooks.onContext(fullContext);

      const worldLoreIdx = result.indexOf("## World Lore");
      const storySummaryIdx = result.indexOf("## Story Summary");
      const memoriesIdx = result.indexOf("## Memories");
      const narrativeChecklistIdx = result.indexOf("## Narrative Checklist");
      const recentStoryIdx = result.indexOf("## Recent Story");
      const authorsNoteIdx = result.indexOf("### Author's Note:");

      expect(worldLoreIdx).toBeGreaterThan(-1);
      expect(storySummaryIdx).toBeGreaterThan(-1);
      expect(memoriesIdx).toBeGreaterThan(-1);
      expect(narrativeChecklistIdx).toBeGreaterThan(-1);
      expect(recentStoryIdx).toBeGreaterThan(-1);
      expect(authorsNoteIdx).toBeGreaterThan(-1);

      expect(worldLoreIdx).toBeLessThan(storySummaryIdx);
      expect(storySummaryIdx).toBeLessThan(memoriesIdx);
      expect(memoriesIdx).toBeLessThan(narrativeChecklistIdx);
      expect(narrativeChecklistIdx).toBeLessThan(recentStoryIdx);
      expect(recentStoryIdx).toBeLessThan(authorsNoteIdx);
    }
  );

  testWithAiDungeonEnvironment(
    "should handle input and output hooks through full pipeline",
    () => {
      createConfigCard(`--- Better You ---
Enable: true
Replacements:
  I: You
  my: your
  me: you

--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false

--- Redundancy ---
Enable: true
SimilarityThreshold: 70`);

      addHistoryAction("You enter the dungeon.", "do");
      addHistoryAction("The dungeon is dark and cold.", "continue");

      const hooks = createFoxTweaks();

      const inputResult = hooks.onInput("> You look at me and grab my sword.");
      expect(inputResult).toContain("You look at you and grab your sword");

      const outputResult = hooks.onOutput(
        "You draw your blade.\nThe steel gleams in the torchlight."
      );
      expect(outputResult).toContain("\n\n");
    }
  );

  testWithAiDungeonEnvironment(
    "should not include unrelated cards even with all modules enabled",
    () => {
      setupIntegrationCards();

      createConfigCard(`--- Debug ---
EnableDebugCards: true

--- Tree Cards ---
Enable: true
ImplicitLinks: true
MaxDepth: 5`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(integrationPreContext);

      expect(result).not.toContain("### Wolves");
      expect(result).toContain("### Foxes");
      expect(result).toContain("### Beastkin");
    }
  );

  testWithAiDungeonEnvironment(
    "should preserve preamble and postamble content",
    () => {
      setupIntegrationCards();

      createConfigCard(`--- Tree Cards ---
Enable: true

--- Context ---
Enable: false`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const hooks = createFoxTweaks();
      const result = hooks.onContext(integrationPreContext);

      expect(result).toContain("### Character");
      expect(result).toContain("You are James");
      expect(result).toContain("### Premise");

      expect(result).toContain("Continue From:");
      expect(result).toContain("Pressure plate?");
      expect(result).toContain("She crouches low");
    }
  );

  testWithAiDungeonEnvironment(
    "should update config card when modules write updates",
    () => {
      const configCard = createConfigCard(`--- Interject ---
Enable: true
MaxTurns: 3
RemainingTurns: 0

--- Narrative Checklist ---
Enable: true
MinTurnsBeforeCheck: 10
RemainingTurns: 5
AlwaysIncludeInContext: false
MinContextChars: 2000`);

      configCard.entry = `Type something here to emphasize it to the AI:

Test interjection message.`;

      globalThis.info = {
        actionCount: 15,
        characterNames: [],
        maxChars: 10000,
      };

      const simpleContext = `World Lore:
Some lore.

Recent Story:
The story.

[Author's note: Be creative.]`;

      const hooks = createFoxTweaks();
      hooks.onContext(simpleContext);

      expect(configCard.description).toContain("RemainingTurns: 2");
    }
  );

  testWithAiDungeonEnvironment(
    "should trigger cards using word-boundary matching when enabled",
    () => {
      const foxCard = globalThis.addStoryCard(
        "fox-card",
        "Fox description here.",
        "race",
        "Fox Card",
        "",
        { returnCard: true }
      );
      if (foxCard && typeof foxCard !== "number") {
        foxCard.keys = ["fox"];
      }

      const foxesCard = globalThis.addStoryCard(
        "foxes-card",
        "Foxes description - should NOT match.",
        "lore",
        "Foxes Card",
        "",
        { returnCard: true }
      );
      if (foxesCard && typeof foxesCard !== "number") {
        foxesCard.keys = ["foxes"];
      }

      createConfigCard(`--- Word Boundary Triggers ---
Enable: true

--- Tree Cards ---
Enable: false

--- Section Injection ---
Enable: false`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const contextWithFox = `### Preamble

World Lore:
Foxes description - should NOT match.

Some extra native card content that takes up more space here.

Recent Story:
The fox jumped over the lazy dog. It was a quick fox.

[Author's note: Be creative.]`;

      const hooks = createFoxTweaks();
      const result = hooks.onContext(contextWithFox);

      expect(result).toContain("Fox description here.");
      expect(result).not.toContain("Foxes description");
    }
  );

  testWithAiDungeonEnvironment(
    "should process word-boundary triggers then tree cards then section injection",
    () => {
      const wolfCard = globalThis.addStoryCard(
        "wolf-card",
        "Wolf is a [[beastkin]] creature.",
        "race",
        "Wolf Card",
        "",
        { returnCard: true }
      );
      if (wolfCard && typeof wolfCard !== "number") {
        wolfCard.keys = ["wolf"];
      }

      const beastkinCard = globalThis.addStoryCard(
        "beastkin-card",
        "Beastkin are humanoids with animal features.",
        "race",
        "Beastkin Card",
        "",
        { returnCard: true }
      );
      if (beastkinCard && typeof beastkinCard !== "number") {
        beastkinCard.keys = ["beastkin"];
      }

      const injectionCard = globalThis.addStoryCard(
        "injection-card",
        '<inject section="preamble" />\nSpecial wolf hunting rules.',
        "lore",
        "Injection Card",
        "",
        { returnCard: true }
      );
      if (injectionCard && typeof injectionCard !== "number") {
        injectionCard.keys = ["wolf-rules"];
      }

      createConfigCard(`--- Word Boundary Triggers ---
Enable: true

--- Tree Cards ---
Enable: true
LinkPercentage: 50

--- Section Injection ---
Enable: true`);

      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        maxChars: 10000,
      };

      const contextWithWolf = `### Preamble

World Lore:
<inject section="preamble" />
Special wolf hunting rules.

Wolf is a [[beastkin]] creature.

Recent Story:
A wolf appeared in the forest. It looked dangerous.

[Author's note: Be creative.]`;

      const hooks = createFoxTweaks();
      const result = hooks.onContext(contextWithWolf);

      expect(result).toContain("Wolf is a beastkin creature.");

      expect(result).toContain("Beastkin are humanoids");

      const preambleEnd = result.indexOf("World Lore:");
      const injectionContent = result.indexOf("Special wolf hunting rules");
      expect(injectionContent).toBeLessThan(preambleEnd);

      expect(result).not.toContain("[[beastkin]]");
      expect(result).not.toContain("<inject");
    }
  );
});
