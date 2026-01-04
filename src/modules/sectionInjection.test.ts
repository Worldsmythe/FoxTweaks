import { describe, it, expect } from "bun:test";
import {
  parseInjectionMarker,
  stripWikilinks,
  SectionInjection,
  type SectionInjectionConfig,
} from "./sectionInjection";
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

describe("parseInjectionMarker", () => {
  it("should parse valid inject marker with self-closing tag", () => {
    const result = parseInjectionMarker(
      '<inject section="preamble" />Content here.'
    );
    expect(result?.target).toBe("preamble");
    expect(result?.cleanedEntry).toBe("Content here.");
  });

  it("should parse inject marker without trailing slash", () => {
    const result = parseInjectionMarker(
      '<inject section="Memories">Content here.'
    );
    expect(result?.target).toBe("Memories");
    expect(result?.cleanedEntry).toBe("Content here.");
  });

  it("should handle all valid section targets", () => {
    const targets = [
      "preamble",
      "World Lore",
      "Story Summary",
      "Memories",
      "Narrative Checklist",
      "Recent Story",
      "Author's Note",
      "postamble",
    ] as const;

    for (const target of targets) {
      const result = parseInjectionMarker(`<inject section="${target}" />Text`);
      expect(result?.target).toBe(target);
    }
  });

  it("should return undefined for invalid section", () => {
    expect(
      parseInjectionMarker('<inject section="InvalidSection" />')
    ).toBeUndefined();
  });

  it("should return undefined for no marker", () => {
    expect(parseInjectionMarker("No marker here.")).toBeUndefined();
  });

  it("should return undefined for malformed marker", () => {
    expect(parseInjectionMarker("<inject section=>")).toBeUndefined();
    expect(parseInjectionMarker('<inject section="">Text')).toBeUndefined();
  });

  it("should be case insensitive for tag name", () => {
    const result = parseInjectionMarker('<INJECT section="preamble" />Content');
    expect(result?.target).toBe("preamble");
  });

  it("should handle marker in middle of text", () => {
    const result = parseInjectionMarker(
      'Before <inject section="Memories" /> after.'
    );
    expect(result?.target).toBe("Memories");
    expect(result?.cleanedEntry).toBe("Before  after.");
  });

  it("should trim cleaned entry", () => {
    const result = parseInjectionMarker(
      '<inject section="preamble" />   Spaced content   '
    );
    expect(result?.cleanedEntry).toBe("Spaced content");
  });
});

describe("stripWikilinks", () => {
  it("should remove brackets but keep text", () => {
    expect(stripWikilinks("The [[Beastkin]] are a race.")).toBe(
      "The Beastkin are a race."
    );
  });

  it("should handle multiple wikilinks", () => {
    expect(stripWikilinks("[[A]] and [[B]] met [[C]].")).toBe("A and B met C.");
  });

  it("should handle wikilinks with spaces", () => {
    expect(stripWikilinks("The [[Character Name]] appeared.")).toBe(
      "The Character Name appeared."
    );
  });

  it("should return text unchanged if no wikilinks", () => {
    expect(stripWikilinks("No links here.")).toBe("No links here.");
  });

  it("should handle empty text", () => {
    expect(stripWikilinks("")).toBe("");
  });

  it("should handle adjacent wikilinks", () => {
    expect(stripWikilinks("[[A]][[B]]")).toBe("AB");
  });
});

describe("SectionInjection Config Parsing", () => {
  it("should parse enable config value", () => {
    const config = SectionInjection.validateConfig({ enable: false });
    expect(config.enable).toBe(false);
  });

  it("should use true as default for enable", () => {
    const config = SectionInjection.validateConfig({});
    expect(config.enable).toBe(true);
  });

  it("should parse string boolean values", () => {
    const config = SectionInjection.validateConfig({ enable: "false" });
    expect(config.enable).toBe(false);
  });
});

describe("SectionInjection Integration", () => {
  const onContext = SectionInjection.hooks.onContext;
  if (!onContext) {
    throw new Error("SectionInjection.hooks.onContext is undefined");
  }

  const enabledConfig: SectionInjectionConfig = {
    enable: true,
  };

  it("should not modify context when disabled", () => {
    const preContext = `### Preamble

World Lore:
<inject section="preamble" />
Content to inject.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Test",
        keys: ["test"],
        entry: '<inject section="preamble" />\nContent to inject.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const config: SectionInjectionConfig = { enable: false };

    const result = onContext(ctx, config);
    const worldLore = getSection(result, "World Lore")?.body ?? "";

    expect(worldLore).toContain("Content to inject");
    expect(result.preamble).not.toContain("Content to inject");
  });

  it("should inject card content to preamble", () => {
    const preContext = `### Preamble

World Lore:
<inject section="preamble" />
## Instructions

These are special instructions.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Instructions",
        keys: ["instructions"],
        entry: '<inject section="preamble" />\n## Instructions\n\nThese are special instructions.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    expect(result.preamble).toContain("## Instructions");
    expect(result.preamble).toContain("These are special instructions");

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).not.toContain("Instructions");
    expect(worldLore).not.toContain("<inject");
  });

  it("should inject card content to postamble", () => {
    const preContext = `### Preamble

World Lore:
<inject section="postamble" />
End of context note.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Postamble",
        keys: ["postamble"],
        entry: '<inject section="postamble" />\nEnd of context note.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    expect(result.postamble).toContain("End of context note");

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).not.toContain("End of context note");
  });

  it("should inject card content to Memories section", () => {
    const preContext = `### Preamble

World Lore:
<inject section="Memories" />
Remember this important fact.

Memories:
Existing memory.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Memory",
        keys: ["memory"],
        entry: '<inject section="Memories" />\nRemember this important fact.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    const memories = getSection(result, "Memories")?.body ?? "";
    expect(memories).toContain("Remember this important fact");
    expect(memories).toContain("Existing memory");

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).not.toContain("Remember this important fact");
  });

  it("should handle multiple injection markers to different sections", () => {
    const preContext = `### Preamble

World Lore:
<inject section="preamble" />
Preamble content.

<inject section="Memories" />
Memory content.

<inject section="postamble" />
Postamble content.

Memories:
Existing.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Preamble Card",
        keys: ["preamble"],
        entry: '<inject section="preamble" />\nPreamble content.',
      }),
      createCard("2", {
        title: "Memory Card",
        keys: ["memory"],
        entry: '<inject section="Memories" />\nMemory content.',
      }),
      createCard("3", {
        title: "Postamble Card",
        keys: ["postamble"],
        entry: '<inject section="postamble" />\nPostamble content.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    expect(result.preamble).toContain("Preamble content");
    expect(result.postamble).toContain("Postamble content");

    const memories = getSection(result, "Memories")?.body ?? "";
    expect(memories).toContain("Memory content");

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).not.toContain("Preamble content");
    expect(worldLore).not.toContain("Memory content");
    expect(worldLore).not.toContain("Postamble content");
  });

  it("should strip wikilinks from injected content", () => {
    const preContext = `### Preamble

World Lore:
<inject section="preamble" />
The [[Beastkin]] are a race.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Beastkin",
        keys: ["beastkin"],
        entry: '<inject section="preamble" />\nThe [[Beastkin]] are a race.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    expect(result.preamble).toContain("The Beastkin are a race");
    expect(result.preamble).not.toContain("[[");
    expect(result.preamble).not.toContain("]]");
  });

  it("should not inject cards targeting World Lore", () => {
    const preContext = `### Preamble

World Lore:
<inject section="World Lore" />
This stays in World Lore.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Lore",
        keys: ["lore"],
        entry: '<inject section="World Lore" />\nThis stays in World Lore.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).toContain("This stays in World Lore");
    expect(result.preamble).not.toContain("This stays in World Lore");
  });

  it("should skip cards without entry", () => {
    const preContext = `### Preamble

World Lore:
Some content.

Recent Story:
The story.`;

    const cards = [createCard("1", { title: "NoEntry", keys: ["noentry"] })];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).toContain("Some content");
  });

  it("should skip cards without injection markers", () => {
    const preContext = `### Preamble

World Lore:
Regular card content.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Regular",
        keys: ["regular"],
        entry: "Regular card content.",
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).toContain("Regular card content");
    expect(result.preamble).not.toContain("Regular card content");
  });

  it("should clean up extra newlines after removal", () => {
    const preContext = `### Preamble

World Lore:
Before.


<inject section="preamble" />
Injected content.


After.

Recent Story:
The story.`;

    const cards = [
      createCard("1", {
        title: "Inject",
        keys: ["inject"],
        entry: '<inject section="preamble" />\nInjected content.',
      }),
    ];

    const ctx = parseContext(preContext, cards, 10000);
    const result = onContext(ctx, enabledConfig);

    const worldLore = getSection(result, "World Lore")?.body ?? "";
    expect(worldLore).not.toContain("\n\n\n");
  });
});
