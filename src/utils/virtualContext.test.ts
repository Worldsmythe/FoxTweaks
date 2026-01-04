import { describe, it, expect } from "bun:test";
import {
  parseContext,
  getSection,
  setSection,
  appendToSection,
  prependToSection,
  removeSection,
  hasWorldLoreCard,
  addWorldLoreCard,
  truncateSection,
  serializeContext,
  getContextLength,
  setPostamble,
  appendToPostamble,
  prependToPostamble,
  setPreamble,
  appendToPreamble,
  type VirtualContext,
  type SectionName,
} from "./virtualContext";

function createCard(
  id: string,
  entry?: string,
  title?: string
): StoryCard {
  return { id, entry, title };
}

function createBasicContext(): string {
  return `AI Instructions here.

World Lore:
The kingdom of Eldoria is vast.

Story Summary:
A hero rises.

Memories:
Remember the ancient prophecy.

Recent Story:
The adventure begins. The hero sets out. Many challenges await. Victory is near. The end approaches.

[Author's note: Keep it epic]`;
}

describe("parseContext", () => {
  it("should parse all sections from context", () => {
    const text = createBasicContext();
    const ctx = parseContext(text, []);

    expect(getSection(ctx, "World Lore")).toBeDefined();
    expect(getSection(ctx, "Story Summary")).toBeDefined();
    expect(getSection(ctx, "Memories")).toBeDefined();
    expect(getSection(ctx, "Recent Story")).toBeDefined();
    expect(getSection(ctx, "Author's Note")).toBeDefined();
  });

  it("should capture preamble before first section", () => {
    const text = createBasicContext();
    const ctx = parseContext(text, []);

    expect(ctx.preamble).toBe("AI Instructions here.");
  });

  it("should extract section bodies without headers", () => {
    const text = createBasicContext();
    const ctx = parseContext(text, []);

    const worldLore = getSection(ctx, "World Lore");
    expect(worldLore?.body).toBe("The kingdom of Eldoria is vast.");
  });

  it("should concatenate duplicate sections", () => {
    const text = `World Lore:
First lore entry.

Recent Story:
Story content.

World Lore:
Second lore entry.`;

    const ctx = parseContext(text, []);
    const worldLore = getSection(ctx, "World Lore");

    expect(worldLore?.body).toContain("First lore entry.");
    expect(worldLore?.body).toContain("Second lore entry.");
  });

  it("should match story cards to World Lore entries", () => {
    const card1 = createCard("1", "The kingdom of Eldoria is vast.");
    const card2 = createCard("2", "Not in context.");
    const text = createBasicContext();

    const ctx = parseContext(text, [card1, card2]);

    expect(ctx.worldLoreCards.length).toBe(1);
    expect(ctx.worldLoreCards[0]?.id).toBe("1");
  });

  it("should store original raw text", () => {
    const text = createBasicContext();
    const ctx = parseContext(text, []);

    expect(ctx.raw).toBe(text);
  });

  it("should store maxChars when provided", () => {
    const text = createBasicContext();
    const ctx = parseContext(text, [], 5000);

    expect(ctx.maxChars).toBe(5000);
  });

  it("should handle Author's Note variants", () => {
    const text = `Recent Story:
Story.

[Author's note: variant 1]`;

    const ctx = parseContext(text, []);
    const authorsNote = getSection(ctx, "Author's Note");

    expect(authorsNote).toBeDefined();
    expect(authorsNote?.body).toContain("variant 1");
  });
});

describe("section operations", () => {
  describe("setSection", () => {
    it("should update existing section body", () => {
      const ctx = parseContext(createBasicContext(), []);
      const updated = setSection(ctx, "World Lore", "New lore content.");

      expect(getSection(updated, "World Lore")?.body).toBe("New lore content.");
    });

    it("should create section if missing", () => {
      const text = `Recent Story:
Just story.`;

      const ctx = parseContext(text, []);
      const updated = setSection(ctx, "Story Summary", "New summary.");

      expect(getSection(updated, "Story Summary")?.body).toBe("New summary.");
      expect(getSection(updated, "Story Summary")?.header).toBe("Story Summary:");
    });

    it("should not mutate original context", () => {
      const ctx = parseContext(createBasicContext(), []);
      const updated = setSection(ctx, "World Lore", "Changed.");

      expect(getSection(ctx, "World Lore")?.body).toBe("The kingdom of Eldoria is vast.");
      expect(getSection(updated, "World Lore")?.body).toBe("Changed.");
    });
  });

  describe("appendToSection", () => {
    it("should append content to existing section", () => {
      const ctx = parseContext(createBasicContext(), []);
      const updated = appendToSection(ctx, "World Lore", "More lore.");

      const body = getSection(updated, "World Lore")?.body;
      expect(body).toContain("The kingdom of Eldoria is vast.");
      expect(body).toContain("More lore.");
    });

    it("should create section if missing", () => {
      const text = `Recent Story:
Story.`;

      const ctx = parseContext(text, []);
      const updated = appendToSection(ctx, "Narrative Checklist", "- Item 1");

      expect(getSection(updated, "Narrative Checklist")?.body).toBe("- Item 1");
    });
  });

  describe("prependToSection", () => {
    it("should prepend content to existing section", () => {
      const ctx = parseContext(createBasicContext(), []);
      const updated = prependToSection(ctx, "World Lore", "Ancient history.");

      const body = getSection(updated, "World Lore")?.body;
      expect(body?.startsWith("Ancient history.")).toBe(true);
      expect(body).toContain("The kingdom of Eldoria is vast.");
    });
  });

  describe("removeSection", () => {
    it("should remove existing section", () => {
      const ctx = parseContext(createBasicContext(), []);
      const updated = removeSection(ctx, "Story Summary");

      expect(getSection(updated, "Story Summary")).toBeUndefined();
      expect(getSection(updated, "World Lore")).toBeDefined();
    });
  });
});

describe("story card operations", () => {
  describe("hasWorldLoreCard", () => {
    it("should return true if card is in context", () => {
      const card = createCard("1", "Entry text.");
      const text = `World Lore:
Entry text.`;

      const ctx = parseContext(text, [card]);

      expect(hasWorldLoreCard(ctx, "1")).toBe(true);
    });

    it("should return false if card is not in context", () => {
      const card = createCard("1", "Entry text.");
      const ctx = parseContext("World Lore:\nOther text.", [card]);

      expect(hasWorldLoreCard(ctx, "1")).toBe(false);
    });
  });

  describe("addWorldLoreCard", () => {
    it("should add card to worldLoreCards array", () => {
      const ctx = parseContext("World Lore:\nExisting.", []);
      const card = createCard("new", "New card entry.");
      const updated = addWorldLoreCard(ctx, card);

      expect(hasWorldLoreCard(updated, "new")).toBe(true);
    });

    it("should append card entry to World Lore body", () => {
      const ctx = parseContext("World Lore:\nExisting.", []);
      const card = createCard("new", "New card entry.");
      const updated = addWorldLoreCard(ctx, card);

      const body = getSection(updated, "World Lore")?.body;
      expect(body).toContain("New card entry.");
    });

    it("should not add duplicate cards", () => {
      const card = createCard("1", "Entry.");
      const ctx = parseContext("World Lore:\nEntry.", [card]);
      const updated = addWorldLoreCard(ctx, card);

      expect(updated.worldLoreCards.length).toBe(1);
    });

    it("should skip cards with empty entries", () => {
      const ctx = parseContext("World Lore:\nExisting.", []);
      const card = createCard("empty", "");
      const updated = addWorldLoreCard(ctx, card);

      expect(hasWorldLoreCard(updated, "empty")).toBe(false);
    });

    it("should create World Lore section if missing", () => {
      const ctx = parseContext("Recent Story:\nJust story.", []);
      const card = createCard("1", "Card entry.");
      const updated = addWorldLoreCard(ctx, card);

      expect(getSection(updated, "World Lore")?.body).toBe("Card entry.");
    });
  });
});

describe("truncateSection", () => {
  it("should truncate from start by default", () => {
    const text = `Recent Story:
First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here. Sixth sentence here.`;

    const ctx = parseContext(text, []);
    const updated = truncateSection(ctx, "Recent Story", {
      targetChars: 80,
      minSentences: 2,
    });

    const body = getSection(updated, "Recent Story")?.body;
    expect(body).not.toContain("First sentence");
    expect(body).toContain("Sixth sentence here.");
  });

  it("should respect minSentences constraint", () => {
    const text = `Recent Story:
One. Two. Three. Four. Five.`;

    const ctx = parseContext(text, []);
    const updated = truncateSection(ctx, "Recent Story", {
      targetChars: 10,
      minSentences: 4,
    });

    const body = getSection(updated, "Recent Story")?.body;
    expect(body).toBeDefined();
  });

  it("should return original if section not found", () => {
    const ctx = parseContext("World Lore:\nLore.", []);
    const updated = truncateSection(ctx, "Recent Story", { targetChars: 50 });

    expect(updated).toBe(ctx);
  });

  it("should return original if already under target", () => {
    const ctx = parseContext("Recent Story:\nShort.", []);
    const updated = truncateSection(ctx, "Recent Story", { targetChars: 1000 });

    expect(getSection(updated, "Recent Story")?.body).toBe("Short.");
  });
});

describe("serializeContext", () => {
  it("should serialize with plain headers", () => {
    const ctx = parseContext(createBasicContext(), []);
    const output = serializeContext(ctx, {
      headerFormat: "plain",
      markdownLevel: "##",
      authorsNoteFormat: "bracket",
    });

    expect(output).toContain("World Lore:");
    expect(output).toContain("Recent Story:");
    expect(output).toContain("[Author's note:");
  });

  it("should serialize with markdown headers", () => {
    const ctx = parseContext(createBasicContext(), []);
    const output = serializeContext(ctx, {
      headerFormat: "markdown",
      markdownLevel: "##",
      authorsNoteFormat: "markdown",
    });

    expect(output).toContain("## World Lore");
    expect(output).toContain("## Recent Story");
    expect(output).toContain("### Author's Note:");
  });

  it("should preserve preamble", () => {
    const ctx = parseContext(createBasicContext(), []);
    const output = serializeContext(ctx);

    expect(output).toContain("AI Instructions here.");
  });

  it("should serialize sections in correct order", () => {
    const text = `Recent Story:
Story first.

World Lore:
Lore second.`;

    const ctx = parseContext(text, []);
    const output = serializeContext(ctx);

    const worldLoreIndex = output.indexOf("World Lore:");
    const recentStoryIndex = output.indexOf("Recent Story:");

    expect(worldLoreIndex).toBeLessThan(recentStoryIndex);
  });

  it("should handle Author's Note bracket format", () => {
    const ctx = parseContext(createBasicContext(), []);
    const output = serializeContext(ctx, {
      headerFormat: "plain",
      markdownLevel: "##",
      authorsNoteFormat: "bracket",
    });

    expect(output).toContain("[Author's note: Keep it epic]");
  });

  it("should handle Author's Note markdown format", () => {
    const ctx = parseContext(createBasicContext(), []);
    const output = serializeContext(ctx, {
      headerFormat: "markdown",
      markdownLevel: "##",
      authorsNoteFormat: "markdown",
    });

    expect(output).toContain("### Author's Note:");
    expect(output).toContain("Keep it epic");
    expect(output).not.toContain("[Author's note:");
  });
});

describe("edge cases", () => {
  describe("bracket handling", () => {
    it("should handle mismatched brackets in Recent Story", () => {
      const text = `Recent Story:
He said [but never finished. The story continues.`;

      const ctx = parseContext(text, []);
      expect(getSection(ctx, "Recent Story")?.body).toContain("[but never finished");
    });

    it("should handle nested brackets in World Lore", () => {
      const text = `World Lore:
Known as [the [Ancient] Order].`;

      const ctx = parseContext(text, []);
      expect(getSection(ctx, "World Lore")?.body).toContain("[the [Ancient] Order]");
    });

    it("should handle wikilink-style brackets", () => {
      const text = `Recent Story:
She mentioned [[someone]] in passing.`;

      const ctx = parseContext(text, []);
      expect(getSection(ctx, "Recent Story")?.body).toContain("[[someone]]");
    });
  });

  describe("empty and missing sections", () => {
    it("should handle empty section body", () => {
      const text = `World Lore:

Recent Story:
Story content.`;

      const ctx = parseContext(text, []);
      expect(getSection(ctx, "World Lore")?.body).toBe("");
    });

    it("should handle text with no sections", () => {
      const text = "Just some plain text with no sections.";
      const ctx = parseContext(text, []);

      expect(ctx.preamble).toBe(text);
      expect(ctx.sections.size).toBe(0);
    });
  });

  describe("immutability", () => {
    it("should not mutate sections map on setSection", () => {
      const ctx = parseContext(createBasicContext(), []);
      const originalSections = ctx.sections;

      setSection(ctx, "World Lore", "Changed.");

      expect(ctx.sections).toBe(originalSections);
    });

    it("should not mutate worldLoreCards on addWorldLoreCard", () => {
      const ctx = parseContext("World Lore:\nExisting.", []);
      const originalCards = ctx.worldLoreCards;

      addWorldLoreCard(ctx, createCard("new", "New entry."));

      expect(ctx.worldLoreCards).toBe(originalCards);
    });
  });
});

describe("postamble", () => {
  describe("parsing", () => {
    it("should capture content after bracket-style Author's Note", () => {
      const text = `Recent Story:
Story content here.

[Author's note: Keep it dramatic]
Last AI response text.
More content after.`;

      const ctx = parseContext(text, []);

      expect(ctx.postamble).toBe("Last AI response text.\nMore content after.");
    });

    it("should capture content after bracket Author's Note on same line", () => {
      const text = `Recent Story:
Story.

[Author's note: Note here] Final content.`;

      const ctx = parseContext(text, []);

      expect(ctx.postamble).toBe("Final content.");
    });

    it("should have empty postamble when nothing after Author's Note", () => {
      const text = `Recent Story:
Story.

[Author's note: The end]`;

      const ctx = parseContext(text, []);

      expect(ctx.postamble).toBe("");
    });

    it("should have empty postamble when no Author's Note exists", () => {
      const text = `World Lore:
Lore content.

Recent Story:
Story content.`;

      const ctx = parseContext(text, []);

      expect(ctx.postamble).toBe("");
    });

  });

  describe("serialization", () => {
    it("should include postamble after sections", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]
Postamble content here.`;

      const ctx = parseContext(text, []);
      const output = serializeContext(ctx);

      expect(output).toContain("Postamble content here.");
      const noteIndex = output.indexOf("[Author's note:");
      const postambleIndex = output.indexOf("Postamble content here.");
      expect(postambleIndex).toBeGreaterThan(noteIndex);
    });

    it("should preserve postamble when modifying sections", () => {
      const text = `World Lore:
Lore.

Recent Story:
Story.

[Author's note: Note]
Important postamble.`;

      const ctx = parseContext(text, []);
      const updated = setSection(ctx, "World Lore", "New lore content.");
      const output = serializeContext(updated);

      expect(output).toContain("New lore content.");
      expect(output).toContain("Important postamble.");
    });
  });

  describe("postamble operations", () => {
    it("setPostamble should replace postamble content", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]
Original postamble.`;

      const ctx = parseContext(text, []);
      const updated = setPostamble(ctx, "New postamble content.");

      expect(updated.postamble).toBe("New postamble content.");
      expect(ctx.postamble).toBe("Original postamble.");
    });

    it("appendToPostamble should add content after existing postamble", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]
First part.`;

      const ctx = parseContext(text, []);
      const updated = appendToPostamble(ctx, "Second part.");

      expect(updated.postamble).toBe("First part.\nSecond part.");
    });

    it("appendToPostamble should handle empty postamble", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]`;

      const ctx = parseContext(text, []);
      const updated = appendToPostamble(ctx, "Added content.");

      expect(updated.postamble).toBe("Added content.");
    });

    it("prependToPostamble should add content before existing postamble", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]
Second part.`;

      const ctx = parseContext(text, []);
      const updated = prependToPostamble(ctx, "First part.");

      expect(updated.postamble).toBe("First part.\nSecond part.");
    });

    it("prependToPostamble should handle empty postamble", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]`;

      const ctx = parseContext(text, []);
      const updated = prependToPostamble(ctx, "Added content.");

      expect(updated.postamble).toBe("Added content.");
    });

    it("should not mutate original context on postamble operations", () => {
      const text = `Recent Story:
Story.

[Author's note: Note]
Original.`;

      const ctx = parseContext(text, []);
      const originalPostamble = ctx.postamble;

      setPostamble(ctx, "Changed.");
      appendToPostamble(ctx, "Appended.");
      prependToPostamble(ctx, "Prepended.");

      expect(ctx.postamble).toBe(originalPostamble);
    });
  });

  describe("addWorldLoreCard with postamble", () => {
    it("should preserve postamble when adding world lore card", () => {
      const text = `World Lore:
Existing lore.

Recent Story:
Story.

[Author's note: Note]
Important postamble.`;

      const ctx = parseContext(text, []);
      const card = createCard("new", "New card entry.");
      const updated = addWorldLoreCard(ctx, card);

      expect(updated.postamble).toBe("Important postamble.");
      expect(getSection(updated, "World Lore")?.body).toContain("New card entry.");
    });
  });
});

describe("preamble operations", () => {
  it("setPreamble should replace preamble content", () => {
    const ctx = parseContext(createBasicContext(), []);
    const updated = setPreamble(ctx, "New preamble content.");

    expect(updated.preamble).toBe("New preamble content.");
    expect(ctx.preamble).toBe("AI Instructions here.");
  });

  it("appendToPreamble should add content after existing preamble", () => {
    const ctx = parseContext(createBasicContext(), []);
    const updated = appendToPreamble(ctx, "Additional instructions.");

    expect(updated.preamble).toBe("AI Instructions here.\n\nAdditional instructions.");
  });

  it("appendToPreamble should handle empty preamble", () => {
    const text = `World Lore:
Lore content.`;

    const ctx = parseContext(text, []);
    const updated = appendToPreamble(ctx, "Added preamble.");

    expect(updated.preamble).toBe("Added preamble.");
  });

  it("should not mutate original context on preamble operations", () => {
    const ctx = parseContext(createBasicContext(), []);
    const originalPreamble = ctx.preamble;

    setPreamble(ctx, "Changed.");
    appendToPreamble(ctx, "Appended.");

    expect(ctx.preamble).toBe(originalPreamble);
  });

  it("should preserve sections when modifying preamble", () => {
    const ctx = parseContext(createBasicContext(), []);
    const updated = appendToPreamble(ctx, "Extra instructions.");

    expect(getSection(updated, "World Lore")?.body).toBe("The kingdom of Eldoria is vast.");
    expect(getSection(updated, "Recent Story")).toBeDefined();
  });
});
