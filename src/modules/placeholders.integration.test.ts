import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { Placeholders } from "./placeholders";
import { SectionInjection } from "./sectionInjection";
import {
  testWithAiDungeonEnvironment,
  createConfigCard,
  addHistoryAction,
} from "../test-utils";

const PLOT_ESSENTIALS_BODY = [
  `Name: {{extract "Name:"}}`,
  `Class: {{extract "Class:"}}`,
  "",
  "{{capture}}",
  `{{removepost "You are"}}`,
].join("\n");

const CREATOR_OUTPUT_TEXT =
  "CHARACTER INFORMATION\nName: Jake\nClass: Sword guy\n\nYou are Jake. You are Jake, a skilled swordsman.";

const REAL_START_TEXT =
  "{Note: Begin a story according to the premise information, if any is given.}\n\nYou're in a normal fantasy world.\n\n\n\n";

const REAL_CONTINUE_TEXT = [
  "You are Jake. You are Jake, a skilled swordsman with a reputation that precedes you. Your black hair falls in waves around your shoulders, and your piercing blue eyes scan the horizon with practiced precision. Your fit body moves with the grace of a warrior, honed by years of training and countless battles.",
  "",
  "You stand at the edge of a bustling town, your sword resting easily at your hip. The sun beats down on the cobblestones, casting long shadows that dance across the street. You've come here seeking work, your reputation drawing the attention of local merchants and adventurers alike.",
  "",
  'A tall, muscular man with a scarred face approaches you. He\'s dressed in leather armor, a long sword hanging at his side. "You\'re Jake, right?" he asks, his voice gruff but respectful. "Name\'s Thorne. Heard you were in town. Got a job that might interest you, if you\'re up for it."',
].join("\n");

const SAMPLE_CONTEXT = (memoriesBody: string) => `World Lore:

Story Summary:

Memories:
${memoriesBody}

Recent Story:
The story begins.`;

describe("Placeholders - Integration", () => {
  testWithAiDungeonEnvironment(
    "resolves capture + extract + cleanup in a full character-creator flow",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction(
        "{Note: Begin a story according to the premise information.}\n\nYou're in a normal fantasy world.",
        "start"
      );
      addHistoryAction(CREATOR_OUTPUT_TEXT, "continue");

      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const inputContext = SAMPLE_CONTEXT(PLOT_ESSENTIALS_BODY);
      const result = hooks.onContext(inputContext);

      expect(result).toContain("Name: Jake");
      expect(result).toContain("Class: Sword guy");
      expect(result).toContain("CHARACTER INFORMATION");
      expect(result).not.toContain("You are Jake");
      expect(result).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "transcludes a story card matched by player's choice",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      const cardLength = addStoryCard(
        "Excalibur",
        "The blade of kings.",
        "mythical-weapons",
        "Excalibur"
      );
      const cardIdx =
        (typeof cardLength === "number" ? cardLength : storyCards.length) - 1;
      const excaliburCard = storyCards[cardIdx];
      if (excaliburCard) excaliburCard.title = "Excalibur";

      addStoryCard("Mjolnir", "Thor's hammer.", "mythical-weapons", "Mjolnir");

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const memoriesBody = `Chosen weapon: {{if Excalibur ~= "mythical-weapons" transclude}}`;
      const result = hooks.onContext(SAMPLE_CONTEXT(memoriesBody));

      expect(result).toContain("The blade of kings.");
      expect(result).not.toContain("Thor's hammer.");
      expect(result).not.toContain("{{if");
    }
  );

  testWithAiDungeonEnvironment(
    "does not crash and leaves capture cache null when no continues exist (actionCount=0)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start text.", "start");
      globalThis.info = { actionCount: 0, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const result = hooks.onContext(SAMPLE_CONTEXT(`Captured: "{{capture}}"`));
      expect(result).toContain('Captured: ""');
    }
  );

  testWithAiDungeonEnvironment(
    "remove sweep handles both string-form and array-form card.keys (real AID stores them as a comma-separated string)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const stringKeysCard: StoryCard = {
        id: "string-keys",
        keys: "trigger_word,{{remove}}" as unknown as string[],
        entry: "Scaffolding entry.",
        type: "scaffold",
        title: "String Keys",
        description: "",
      };
      storyCards.push(stringKeysCard);

      const arrayKeysCard: StoryCard = {
        id: "array-keys",
        keys: ["another_trigger"],
        entry: "Body with {{remove}} inside.",
        type: "scaffold",
        title: "Array Keys",
        description: "",
      };
      storyCards.push(arrayKeysCard);

      const survivor: StoryCard = {
        id: "survivor",
        keys: "ordinary,keywords" as unknown as string[],
        entry: "Nothing to see here.",
        type: "lore",
        title: "Survivor",
        description: "",
      };
      storyCards.push(survivor);

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      hooks.onContext(SAMPLE_CONTEXT("Body."));
      hooks.onOutput("AI response.");

      const titles = storyCards.map((c) => c.title);
      expect(titles).not.toContain("String Keys");
      expect(titles).not.toContain("Array Keys");
      expect(titles).toContain("Survivor");
    }
  );

  testWithAiDungeonEnvironment(
    "remove sweep fires once and deletes scaffolding cards on the first eligible turn",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addStoryCard(
        "scaffolding",
        "Choose your class.\n{{remove}}",
        "creator",
        "Class Choices"
      );
      addStoryCard("keep me", "Important card.", "lore", "Important");

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      addHistoryAction("Player input.", "do");

      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const beforeCount = storyCards.length;
      hooks.onContext(SAMPLE_CONTEXT("Body."));
      hooks.onOutput("AI response.");

      const titles = storyCards.map((c) => c.title);
      expect(titles).not.toContain("Class Choices");
      expect(titles).toContain("Important");
      expect(storyCards.length).toBe(beforeCount - 1);
    }
  );

  testWithAiDungeonEnvironment(
    "remove sweep does not fire on later turns",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addStoryCard("late marker", "Body.\n{{remove}}", "scaffold", "Late");

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");

      globalThis.info = { actionCount: 5, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const beforeCount = storyCards.length;
      hooks.onContext(SAMPLE_CONTEXT("Body."));
      hooks.onOutput("AI response.");

      expect(storyCards.length).toBe(beforeCount);
    }
  );

  testWithAiDungeonEnvironment(
    "transclude can use a card on turn 1 before the sweep removes it (sweep is the last pass of onContext)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addStoryCard(
        "Excalibur",
        "The legendary blade of kings.\n{{remove}}",
        "mythical-weapons",
        "Excalibur"
      );

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const beforeCount = storyCards.length;
      const result = hooks.onContext(
        SAMPLE_CONTEXT(
          `Your weapon: {{if Excalibur ~= "mythical-weapons" transclude}}`
        )
      );

      expect(result).toContain("Your weapon: The legendary blade of kings.");
      expect(result).not.toContain("{{remove}}");
      expect(storyCards.length).toBe(beforeCount - 1);
      const titles = storyCards.map((c) => c.title);
      expect(titles).not.toContain("Excalibur");
    }
  );

  testWithAiDungeonEnvironment(
    "capture cache stays stable across turns once populated",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Original creator text.", "continue");

      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const memoriesBody = "Captured: {{capture}}";
      const first = hooks.onContext(SAMPLE_CONTEXT(memoriesBody));
      expect(first).toContain("Captured: Original creator text.");

      addHistoryAction("Player input.", "do");
      addHistoryAction("Another continue (post-player).", "continue");
      globalThis.info = { actionCount: 3, characterNames: [] };

      const second = hooks.onContext(SAMPLE_CONTEXT(memoriesBody));
      expect(second).toContain("Captured: Original creator text.");
      expect(second).not.toContain("Another continue");
    }
  );

  testWithAiDungeonEnvironment(
    "coexists with SectionInjection without interference",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true

--- Section Injection ---
Enable: true`);

      addStoryCard(
        "lore",
        '<inject section="preamble" />\nInjected from a card.',
        "lore",
        "Lore"
      );

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      core.registerModule(SectionInjection);
      const hooks = core.createHooks();

      const memoriesBody = `Captured: {{capture}}`;
      const inputContext = `### Preamble

World Lore:
<inject section="preamble" />
Injected from a card.

Memories:
${memoriesBody}

Recent Story:
The story.`;

      const result = hooks.onContext(inputContext);

      expect(result).toContain("Captured: Creator output.");
      expect(result).toContain("Injected from a card.");
    }
  );

  testWithAiDungeonEnvironment(
    "handles the real char-creator history shape (prose continue + scenario-authored structured fields)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction(REAL_START_TEXT, "start");
      addHistoryAction(REAL_CONTINUE_TEXT, "continue");

      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const plotEssentialsBody = [
        "CHARACTER INFORMATION",
        "Name: Jake",
        "Gender: male",
        "Class: Sword guy",
        "Attractiveness: Beautiful",
        "",
        "{{capture}}",
        `{{removepost "You are"}}`,
      ].join("\n");

      const result = hooks.onContext(SAMPLE_CONTEXT(plotEssentialsBody));

      expect(result).toContain("CHARACTER INFORMATION");
      expect(result).toContain("Name: Jake");
      expect(result).toContain("Attractiveness: Beautiful");

      expect(result).not.toContain("You are Jake");
      expect(result).not.toContain("Thorne");
      expect(result).not.toContain("bustling town");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("removepost");
    }
  );

  testWithAiDungeonEnvironment(
    "composes filter + extract + capitalize across captured creator output",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction(
        "Character Name: jake\nCharacter Class: sword guy\n\nYou wake up in a tavern.",
        "continue"
      );

      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const plotEssentialsBody = [
        `Name: {{filter capitalize {{extract "Character Name:"}}}}`,
        `Class: {{filter upper {{extract "Character Class:"}}}}`,
        "",
        "{{capture}}",
        `{{removepost "You wake up"}}`,
      ].join("\n");

      const result = hooks.onContext(SAMPLE_CONTEXT(plotEssentialsBody));

      expect(result).toContain("Name: Jake");
      expect(result).toContain("Class: SWORD GUY");
      expect(result).toContain("Character Name: jake");
      expect(result).not.toContain("You wake up");
      expect(result).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "nests default inside if-transclude and respects cleanup ordering",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addStoryCard(
        "Excalibur",
        "The legendary blade {{filter capitalize excalibur}} of kings.",
        "mythical-weapons",
        "Excalibur"
      );

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const memoriesBody = [
        "Your weapon:",
        `{{if Excalibur ~= "mythical-weapons" transclude}}`,
        "",
        "Filler line that should survive.",
        `{{removepost "Filler line"}}`,
      ].join("\n");

      const result = hooks.onContext(SAMPLE_CONTEXT(memoriesBody));

      expect(result).toContain("The legendary blade Excalibur of kings.");
      expect(result).not.toContain("Filler line");
      expect(result).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "traveling-companion pattern: both inputs filled produces a wrapped + bare phrase",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const filledTemplate =
        "{{default " +
        "{{cleanup Kira | You are traveling with | ,}} " +
        "{{cleanup A warrior of some renown with auburn hair and green eyes.}} " +
        "| You are traveling alone.}}";

      const result = hooks.onContext(SAMPLE_CONTEXT(filledTemplate));

      expect(result).toContain(
        "You are traveling with Kira, A warrior of some renown with auburn hair and green eyes."
      );
      expect(result).not.toContain("You are traveling alone.");
      expect(result).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "traveling-companion pattern: both inputs skipped falls back via outer default",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const skippedTemplate =
        "{{default " +
        "{{cleanup {name?} | You are traveling with | ,}} " +
        "{{cleanup {description?}}} " +
        "| You are traveling alone.}}";

      const result = hooks.onContext(SAMPLE_CONTEXT(skippedTemplate));

      expect(result).toContain("You are traveling alone.");
      expect(result).not.toContain("You are traveling with");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("{name?}");
    }
  );

  testWithAiDungeonEnvironment(
    "traveling-companion pattern: player typed a value (not $) for the toggle, partials linger → fallback fires",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const stragglerTemplate =
        "{{default " +
        "{{cleanup Kira{Traveling companion's name?} | You are traveling with | ,}} " +
        "{{cleanup Kira{Traveling companion's physical description?}}} " +
        "| You are traveling alone.}}";

      const result = hooks.onContext(SAMPLE_CONTEXT(stragglerTemplate));

      expect(result).toContain("You are traveling alone.");
      expect(result).not.toContain("You are traveling with");
      expect(result).not.toContain("Kira");
      expect(result).not.toContain("{Traveling");
    }
  );

  testWithAiDungeonEnvironment(
    "traveling-companion pattern: composes with capitalize + uncapitalize filters",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const template =
        "{{default " +
        "{{cleanup {{filter capitalize kira}} | You are traveling with | ,}} " +
        "{{cleanup {{filter uncapitalize A warrior of some renown.}}}} " +
        "| You are traveling alone.}}";

      const result = hooks.onContext(SAMPLE_CONTEXT(template));

      expect(result).toContain(
        "You are traveling with Kira, a warrior of some renown."
      );
    }
  );

  testWithAiDungeonEnvironment(
    "onOutput bakes the resolved Plot Essentials on cache-efficient models too",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction(
        "CHARACTER INFORMATION\nName: Jake\nClass: Sword guy\n\nYou are Jake. You are great.",
        "continue"
      );
      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        useCacheEfficient: true,
      };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const preamble = 'Name: {{extract "Name:"}}\nClass: {{extract "Class:"}}';
      const fullContext = `${preamble}

World Lore:

Story Summary:

Memories:

Recent Story:
The story begins.`;

      hooks.onContext(fullContext);
      hooks.onOutput("AI response.");

      expect(typeof state.memory.context).toBe("string");
      expect(state.memory.context as unknown as string).toContain("Name: Jake");
      expect(state.memory.context as unknown as string).toContain(
        "Class: Sword guy"
      );
      expect(state.memory.context as unknown as string).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "onOutput bakes Plot Essentials regardless of cache-efficient flag (placeholders are author-time tools)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction(
        "CHARACTER INFORMATION\nName: Jake\nClass: Sword guy\n\nYou are Jake.",
        "continue"
      );
      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        useCacheEfficient: false,
      };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const preamble = 'Name: {{extract "Name:"}}\nClass: {{extract "Class:"}}';
      const fullContext = `${preamble}

World Lore:

Recent Story:
The story.`;
      hooks.onContext(fullContext);
      hooks.onOutput("AI response.");

      expect(typeof state.memory.context).toBe("string");
      expect(state.memory.context as unknown as string).toContain("Name: Jake");
      expect(state.memory.context as unknown as string).toContain(
        "Class: Sword guy"
      );
      expect(state.memory.context as unknown as string).not.toContain("{{");
    }
  );

  testWithAiDungeonEnvironment(
    "onOutput never bakes Author's Note (transient-conflict risk)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        useCacheEfficient: true,
      };
      const initialAuthorsNote = state.memory.authorsNote;

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      hooks.onContext(`Plot.

World Lore:

Recent Story:
Stuff.

[Author's note: keep it grim]`);
      hooks.onOutput("AI response.");

      expect(state.memory.authorsNote).toBe(initialAuthorsNote);
    }
  );

  testWithAiDungeonEnvironment(
    "onOutput bakes resolved story card entries (markers are author-time, not transient)",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addStoryCard(
        "card-with-markers",
        "Resolved: {{filter capitalize hello}}.",
        "lore",
        "Card With Markers"
      );
      addStoryCard(
        "plain-card",
        "No markers here.",
        "lore",
        "Plain Card"
      );

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = {
        actionCount: 1,
        characterNames: [],
        useCacheEfficient: true,
      };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      hooks.onContext(SAMPLE_CONTEXT("Body."));
      hooks.onOutput("AI response.");

      const markedCard = storyCards.find((c) => c.title === "Card With Markers");
      const plainCard = storyCards.find((c) => c.title === "Plain Card");
      expect(markedCard?.entry).toBe("Resolved: Hello.");
      expect(plainCard?.entry).toBe("No markers here.");
    }
  );

  testWithAiDungeonEnvironment(
    "comments wrap and hide other markers entirely",
    () => {
      createConfigCard(`--- Placeholders ---
Enable: true`);

      addHistoryAction("Start.", "start");
      addHistoryAction("Creator output.", "continue");
      globalThis.info = { actionCount: 1, characterNames: [] };

      const core = new FoxTweaks();
      core.registerModule(Placeholders);
      const hooks = core.createHooks();

      const memoriesBody = [
        "Visible content.",
        "{{% TODO: re-enable later: {{capture}} %}}",
        "More visible content.",
      ].join("\n");

      const result = hooks.onContext(SAMPLE_CONTEXT(memoriesBody));

      expect(result).toContain("Visible content.");
      expect(result).toContain("More visible content.");
      expect(result).not.toContain("TODO");
      expect(result).not.toContain("Creator output.");
    }
  );

  describe("e2e sample Plot Essentials", () => {
    const SAMPLE_PLOT_ESSENTIALS = (info: {
      name: string;
      age: string;
      classText: string;
      weapon: string;
      description: string;
      companionName: string;
      companionDesc: string;
    }) => `{{% Plot Essentials for an interactive fantasy adventure %}}

You are {{default {{filter capitalize {{extract "Name:"}}}} | a nameless wanderer}}, a {{default {{filter lower {{extract "Class:"}}}} | drifter}}. {{if {{extract "Age:"}} >= 18 | An adult ready for adventure. | A youth on the cusp of greatness.}}

Your weapon: {{default {{if {{extract "Weapon:"}} ~= "mythical-weapons" transclude}} | bare-handed}}

{{default {{cleanup ${info.companionName} | You travel with | ,}} {{filter uncapitalize {{cleanup ${info.companionDesc}}}}} | You travel alone.}}

{{filter dedupe 'Notes: ${info.description}.' | .}}

{{removeafter "CHARACTER INFORMATION"}}

CHARACTER INFORMATION
Name: ${info.name}
Age: ${info.age}
Class: ${info.classText}
Weapon: ${info.weapon}
Description: ${info.description}`;

    const sampleContextWithPreamble = (preamble: string) => `${preamble}

World Lore:

Story Summary:

Memories:

Recent Story:
The story begins.`;

    function setupWeaponCards() {
      addStoryCard(
        "Excalibur",
        "The legendary blade of kings, edged with starlight.",
        "mythical-weapons",
        "Excalibur"
      );
      addStoryCard(
        "Mjolnir",
        "Thor's hammer, crackling with the storm.",
        "mythical-weapons",
        "Mjolnir"
      );
      addStoryCard(
        "Zeus' Bolt",
        "A spear forged from a lightning strike.",
        "mythical-weapons",
        "Zeus' Bolt"
      );
    }

    testWithAiDungeonEnvironment(
      "resolves every marker type when the player fills in all inputs",
      () => {
        createConfigCard(`--- Placeholders ---
Enable: true`);

        setupWeaponCards();
        addHistoryAction("Start.", "start");
        addHistoryAction("You wake in a tavern.", "continue");
        globalThis.info = { actionCount: 1, characterNames: [] };

        const core = new FoxTweaks();
        core.registerModule(Placeholders);
        const hooks = core.createHooks();

        const preamble = SAMPLE_PLOT_ESSENTIALS({
          name: "jake",
          age: "25",
          classText: "Swordsman",
          weapon: "Excalibur",
          description: "Tall and lean with sharp blue eyes.",
          companionName: "Kira",
          companionDesc: "A foxkin warrior with copper hair.",
        });

        const result = hooks.onContext(sampleContextWithPreamble(preamble));

        expect(result).toContain("You are Jake, a swordsman.");
        expect(result).toContain("An adult ready for adventure.");
        expect(result).toContain(
          "Your weapon: The legendary blade of kings, edged with starlight."
        );
        expect(result).toContain(
          "You travel with Kira, a foxkin warrior with copper hair."
        );
        expect(result).toContain(
          "Notes: Tall and lean with sharp blue eyes."
        );
        expect(result).not.toContain("CHARACTER INFORMATION");
        expect(result).not.toContain("Tall and lean with sharp blue eyes..");
        expect(result).not.toContain("{{");
        expect(result).not.toContain("%}}");
      }
    );

    testWithAiDungeonEnvironment(
      "falls through to all defaults when the player skips every input",
      () => {
        createConfigCard(`--- Placeholders ---
Enable: true`);

        setupWeaponCards();
        addHistoryAction("Start.", "start");
        addHistoryAction("You wake in a tavern.", "continue");
        globalThis.info = { actionCount: 1, characterNames: [] };

        const core = new FoxTweaks();
        core.registerModule(Placeholders);
        const hooks = core.createHooks();

        const preamble = SAMPLE_PLOT_ESSENTIALS({
          name: "",
          age: "",
          classText: "",
          weapon: "",
          description: "",
          companionName: "{Companion name?}",
          companionDesc: "{Companion description?}",
        });

        const result = hooks.onContext(sampleContextWithPreamble(preamble));

        expect(result).toContain("You are a nameless wanderer, a drifter.");
        expect(result).toContain("A youth on the cusp of greatness.");
        expect(result).toContain("Your weapon: bare-handed");
        expect(result).toContain("You travel alone.");
        expect(result).not.toContain("CHARACTER INFORMATION");
        expect(result).not.toContain("{{");
        expect(result).not.toContain("{Companion");
      }
    );

    testWithAiDungeonEnvironment(
      "partial fill: name + age + class only, weapon and companion fall back, description survives dedupe",
      () => {
        createConfigCard(`--- Placeholders ---
Enable: true`);

        setupWeaponCards();
        addHistoryAction("Start.", "start");
        addHistoryAction("You wake in a tavern.", "continue");
        globalThis.info = { actionCount: 1, characterNames: [] };

        const core = new FoxTweaks();
        core.registerModule(Placeholders);
        const hooks = core.createHooks();

        const preamble = SAMPLE_PLOT_ESSENTIALS({
          name: "miriam",
          age: "16",
          classText: "Apprentice",
          weapon: "",
          description: "Short and quick with curious eyes",
          companionName: "{Companion name?}",
          companionDesc: "{Companion description?}",
        });

        const result = hooks.onContext(sampleContextWithPreamble(preamble));

        expect(result).toContain("You are Miriam, a apprentice.");
        expect(result).toContain("A youth on the cusp of greatness.");
        expect(result).toContain("Your weapon: bare-handed");
        expect(result).toContain("You travel alone.");
        expect(result).toContain(
          "Notes: Short and quick with curious eyes."
        );
        expect(result).not.toContain("CHARACTER INFORMATION");
        expect(result).not.toContain("{{");
      }
    );
  });
});
