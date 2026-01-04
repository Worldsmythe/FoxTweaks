import { describe, it, expect } from "bun:test";
import {
  extractWikilinks,
  findCardByReference,
  extractImplicitLinks,
  findTriggeredCards,
  collectLinkedCards,
  parseInjectionMarker,
  stripWikilinks,
  type TreeCardsConfig,
} from "./treeCards";

function createCard(
  id: string,
  options: {
    title?: string;
    keys?: string[];
    entry?: string;
  } = {}
): StoryCard {
  return {
    id,
    title: options.title,
    keys: options.keys,
    entry: options.entry,
  };
}

describe("extractWikilinks", () => {
  it("should extract single wikilink", () => {
    const text = "This mentions [[Character A]] in the story.";
    const links = extractWikilinks(text);
    expect(links).toEqual(["Character A"]);
  });

  it("should extract multiple wikilinks", () => {
    const text = "[[Character A]] met [[Character B]] at [[Location C]].";
    const links = extractWikilinks(text);
    expect(links).toEqual(["Character A", "Character B", "Location C"]);
  });

  it("should handle wikilinks with extra whitespace", () => {
    const text = "Mentions [[ Character A ]] here.";
    const links = extractWikilinks(text);
    expect(links).toEqual(["Character A"]);
  });

  it("should return empty array for text without wikilinks", () => {
    const text = "No links here, just [single brackets].";
    const links = extractWikilinks(text);
    expect(links).toEqual([]);
  });

  it("should handle empty text", () => {
    const links = extractWikilinks("");
    expect(links).toEqual([]);
  });

  it("should handle nested-looking brackets", () => {
    const text = "[[outer]] and [not a link] and [[inner]].";
    const links = extractWikilinks(text);
    expect(links).toEqual(["outer", "inner"]);
  });

  it("should not match incomplete brackets", () => {
    const text = "[[incomplete and [[also incomplete";
    const links = extractWikilinks(text);
    expect(links).toEqual([]);
  });
});

describe("findCardByReference", () => {
  const cards = [
    createCard("1", { title: "Character A", keys: ["char-a", "protagonist"] }),
    createCard("2", { title: "Location B", keys: ["loc-b", "tavern"] }),
    createCard("3", { title: "Item C", keys: ["sword", "weapon"] }),
  ];

  it("should find card by exact title match (case insensitive)", () => {
    const found = findCardByReference("Character A", cards);
    expect(found?.id).toBe("1");
  });

  it("should find card by title with different case", () => {
    const found = findCardByReference("character a", cards);
    expect(found?.id).toBe("1");
  });

  it("should find card by key substring match", () => {
    const found = findCardByReference("protagonist", cards);
    expect(found?.id).toBe("1");
  });

  it("should find card by partial key match", () => {
    const found = findCardByReference("char", cards);
    expect(found?.id).toBe("1");
  });

  it("should prefer title match over key match", () => {
    const cardsWithOverlap = [
      createCard("1", { title: "Sword", keys: ["blade"] }),
      createCard("2", { title: "Blade", keys: ["sword"] }),
    ];
    const found = findCardByReference("Sword", cardsWithOverlap);
    expect(found?.id).toBe("1");
  });

  it("should return undefined for no match", () => {
    const found = findCardByReference("nonexistent", cards);
    expect(found).toBeUndefined();
  });

  it("should handle empty cards array", () => {
    const found = findCardByReference("anything", []);
    expect(found).toBeUndefined();
  });
});

describe("extractImplicitLinks", () => {
  const cards = [
    createCard("1", { keys: ["foxkin", "fox-people"] }),
    createCard("2", { keys: ["magic", "arcane"] }),
    createCard("3", { keys: ["sword"] }),
  ];

  it("should find cards whose keys appear in entry", () => {
    const entry = "The foxkin village was protected by magic.";
    const linked = extractImplicitLinks(entry, cards);
    expect(linked.map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("should be case insensitive", () => {
    const entry = "The FOXKIN used MAGIC.";
    const linked = extractImplicitLinks(entry, cards);
    expect(linked.map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("should match partial key occurrences (substring)", () => {
    const entry = "She carried a longsword.";
    const linked = extractImplicitLinks(entry, cards);
    expect(linked.map((c) => c.id)).toEqual(["3"]);
  });

  it("should return empty array for no matches", () => {
    const entry = "No keywords here.";
    const linked = extractImplicitLinks(entry, cards);
    expect(linked).toEqual([]);
  });

  it("should handle cards without keys", () => {
    const cardsWithoutKeys = [createCard("1", { title: "Test" })];
    const entry = "Some text.";
    const linked = extractImplicitLinks(entry, cardsWithoutKeys);
    expect(linked).toEqual([]);
  });
});

describe("findTriggeredCards", () => {
  const cards = [
    createCard("1", { entry: "Entry for card 1." }),
    createCard("2", { entry: "Entry for card 2." }),
    createCard("3", { entry: "Entry for card 3." }),
  ];

  it("should find cards whose entries appear in world lore", () => {
    const worldLore = "Some intro.\n\nEntry for card 1.\n\nEntry for card 3.";
    const triggered = findTriggeredCards(worldLore, cards);
    expect(triggered.map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("should return empty array when no cards match", () => {
    const worldLore = "No matching entries here.";
    const triggered = findTriggeredCards(worldLore, cards);
    expect(triggered).toEqual([]);
  });

  it("should handle cards without entries", () => {
    const cardsWithoutEntries = [createCard("1", { title: "Test" })];
    const worldLore = "Some content.";
    const triggered = findTriggeredCards(worldLore, cardsWithoutEntries);
    expect(triggered).toEqual([]);
  });
});

describe("collectLinkedCards", () => {
  const defaultConfig: TreeCardsConfig = {
    enable: true,
    linkPercentage: 20,
    implicitLinks: false,
    maxDepth: 3,
    minSentences: 10,
  };

  it("should collect cards linked via wikilinks", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "This links to [[Card B]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Card B content.",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked.map((c) => c.id)).toEqual(["b"]);
  });

  it("should order dependencies before dependents (simple case)", () => {
    const fox = createCard("fox", {
      title: "Fox",
      entry: "A [[Beastkin]] creature.",
    });
    const beastkin = createCard("beastkin", {
      title: "Beastkin",
      entry: "A beast race.",
    });
    const allCards = [fox, beastkin];

    const linked = collectLinkedCards([fox], allCards, defaultConfig);
    expect(linked[0]?.id).toBe("beastkin");
  });

  it("should order shared dependencies first (diamond pattern)", () => {
    const a = createCard("a", {
      title: "A",
      entry: "Links to [[B]] and [[C]].",
    });
    const b = createCard("b", {
      title: "B",
      entry: "Links to [[D]].",
    });
    const c = createCard("c", {
      title: "C",
      entry: "Links to [[D]].",
    });
    const d = createCard("d", {
      title: "D",
      entry: "Base dependency.",
    });
    const allCards = [a, b, c, d];

    const linked = collectLinkedCards([a], allCards, defaultConfig);
    const dIndex = linked.findIndex((card) => card.id === "d");
    const bIndex = linked.findIndex((card) => card.id === "b");
    const cIndex = linked.findIndex((card) => card.id === "c");

    expect(dIndex).toBeLessThan(bIndex);
    expect(dIndex).toBeLessThan(cIndex);
  });

  it("should handle chain dependencies", () => {
    const a = createCard("a", {
      title: "A",
      entry: "Links to [[B]].",
    });
    const b = createCard("b", {
      title: "B",
      entry: "Links to [[C]].",
    });
    const c = createCard("c", {
      title: "C",
      entry: "Links to [[D]].",
    });
    const d = createCard("d", {
      title: "D",
      entry: "End of chain.",
    });
    const allCards = [a, b, c, d];

    const linked = collectLinkedCards([a], allCards, defaultConfig);
    expect(linked.map((card) => card.id)).toEqual(["d", "c", "b"]);
  });

  it("should handle multiple trigger cards with shared dependencies", () => {
    const fox = createCard("fox", {
      title: "Fox",
      entry: "A [[Beastkin]] with [[Magic]].",
    });
    const wolf = createCard("wolf", {
      title: "Wolf",
      entry: "Another [[Beastkin]].",
    });
    const beastkin = createCard("beastkin", {
      title: "Beastkin",
      entry: "A beast race.",
    });
    const magic = createCard("magic", {
      title: "Magic",
      entry: "Mystical power.",
    });
    const allCards = [fox, wolf, beastkin, magic];

    const linked = collectLinkedCards([fox, wolf], allCards, defaultConfig);

    const beastkinIndex = linked.findIndex((card) => card.id === "beastkin");
    expect(beastkinIndex).toBeGreaterThanOrEqual(0);
    expect(linked.some((card) => card.id === "magic")).toBe(true);
  });

  it("should follow links and discover cards", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Card B]] and [[Card C]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Links to [[Card D]].",
    });
    const cardC = createCard("c", {
      title: "Card C",
      entry: "Card C content.",
    });
    const cardD = createCard("d", {
      title: "Card D",
      entry: "Card D content.",
    });
    const allCards = [cardA, cardB, cardC, cardD];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked.length).toBe(3);
    expect(linked.some((c) => c.id === "b")).toBe(true);
    expect(linked.some((c) => c.id === "c")).toBe(true);
    expect(linked.some((c) => c.id === "d")).toBe(true);

    const dIndex = linked.findIndex((c) => c.id === "d");
    const bIndex = linked.findIndex((c) => c.id === "b");
    expect(dIndex).toBeLessThan(bIndex);
  });

  it("should respect maxDepth limit", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Card B]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Links to [[Card C]].",
    });
    const cardC = createCard("c", {
      title: "Card C",
      entry: "Links to [[Card D]].",
    });
    const cardD = createCard("d", {
      title: "Card D",
      entry: "Card D content.",
    });
    const allCards = [cardA, cardB, cardC, cardD];

    const configDepth2 = { ...defaultConfig, maxDepth: 2 };
    const linked = collectLinkedCards([cardA], allCards, configDepth2);
    expect(linked.length).toBe(2);
    expect(linked.some((c) => c.id === "b")).toBe(true);
    expect(linked.some((c) => c.id === "c")).toBe(true);
    expect(linked.some((c) => c.id === "d")).toBe(false);

    const cIndex = linked.findIndex((c) => c.id === "c");
    const bIndex = linked.findIndex((c) => c.id === "b");
    expect(cIndex).toBeLessThan(bIndex);
  });

  it("should prevent cycles", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Card B]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Links back to [[Card A]].",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked.map((c) => c.id)).toEqual(["b"]);
  });

  it("should not include trigger cards in result", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Card B]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Card B content.",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked.some((c) => c.id === "a")).toBe(false);
  });

  it("should include implicit links when enabled", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "The foxkin appeared.",
    });
    const cardB = createCard("b", {
      title: "Card B",
      keys: ["foxkin"],
      entry: "Card B about foxkin.",
    });
    const allCards = [cardA, cardB];

    const configWithImplicit = { ...defaultConfig, implicitLinks: true };
    const linked = collectLinkedCards([cardA], allCards, configWithImplicit);
    expect(linked.map((c) => c.id)).toEqual(["b"]);
  });

  it("should not include implicit links when disabled", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "The foxkin appeared.",
    });
    const cardB = createCard("b", {
      title: "Card B",
      keys: ["foxkin"],
      entry: "Card B about foxkin.",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked).toEqual([]);
  });

  it("should handle cards without entries", () => {
    const cardA = createCard("a", {
      title: "Card A",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Card B content.",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked).toEqual([]);
  });

  it("should skip non-existent link targets", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Nonexistent Card]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Card B content.",
    });
    const allCards = [cardA, cardB];

    const linked = collectLinkedCards([cardA], allCards, defaultConfig);
    expect(linked).toEqual([]);
  });

  it("should handle multiple trigger cards", () => {
    const cardA = createCard("a", {
      title: "Card A",
      entry: "Links to [[Card C]].",
    });
    const cardB = createCard("b", {
      title: "Card B",
      entry: "Links to [[Card D]].",
    });
    const cardC = createCard("c", {
      title: "Card C",
      entry: "Card C content.",
    });
    const cardD = createCard("d", {
      title: "Card D",
      entry: "Card D content.",
    });
    const allCards = [cardA, cardB, cardC, cardD];

    const linked = collectLinkedCards([cardA, cardB], allCards, defaultConfig);
    expect(linked.map((c) => c.id)).toEqual(["c", "d"]);
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

describe("TreeCards Config Parsing", () => {
  const { TreeCards } = require("./treeCards") as {
    TreeCards: {
      validateConfig: (raw: Record<string, unknown>) => TreeCardsConfig;
    };
  };

  it("should parse all config values", () => {
    const raw = {
      enable: true,
      linkpercentage: "30",
      implicitlinks: "true",
      maxdepth: "5",
      minsentences: "15",
    };
    const config = TreeCards.validateConfig(raw);

    expect(config.enable).toBe(true);
    expect(config.linkPercentage).toBe(30);
    expect(config.implicitLinks).toBe(true);
    expect(config.maxDepth).toBe(5);
    expect(config.minSentences).toBe(15);
  });

  it("should use defaults for missing values", () => {
    const config = TreeCards.validateConfig({});

    expect(config.enable).toBe(false);
    expect(config.linkPercentage).toBe(20);
    expect(config.implicitLinks).toBe(false);
    expect(config.maxDepth).toBe(3);
    expect(config.minSentences).toBe(10);
  });

  it("should enforce constraints on linkPercentage", () => {
    const config = TreeCards.validateConfig({
      linkpercentage: "150",
    });
    expect(config.linkPercentage).toBe(20);
  });

  it("should enforce constraints on maxDepth", () => {
    const config = TreeCards.validateConfig({
      maxdepth: "0",
    });
    expect(config.maxDepth).toBe(3);
  });
});
