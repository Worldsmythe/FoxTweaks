import { describe, it, expect } from "bun:test";
import {
  countSentences,
  truncateSectionFromStart,
  injectWorldLore,
  injectStoryCard,
  parseContextSections,
  replaceHeaders,
} from "./contextPipeline";

function createContext(options: {
  worldLore?: string;
  recentStory?: string;
  memories?: string;
  authorsNote?: string;
}): string {
  const parts: string[] = [];

  if (options.worldLore !== undefined) {
    parts.push(`World Lore:\n${options.worldLore}`);
  }
  if (options.memories !== undefined) {
    parts.push(`Memories:\n${options.memories}`);
  }
  if (options.recentStory !== undefined) {
    parts.push(`Recent Story:\n${options.recentStory}`);
  }
  if (options.authorsNote !== undefined) {
    parts.push(`[Author's note: ${options.authorsNote}]`);
  }

  return parts.join("\n\n");
}

describe("countSentences", () => {
  it("should count sentences ending with period", () => {
    expect(countSentences("First sentence. Second sentence.")).toBe(2);
  });

  it("should count sentences ending with exclamation", () => {
    expect(countSentences("Wow! Amazing!")).toBe(2);
  });

  it("should count sentences ending with question mark", () => {
    expect(countSentences("What? Why?")).toBe(2);
  });

  it("should count mixed sentence endings", () => {
    expect(countSentences("Statement. Question? Exclamation!")).toBe(3);
  });

  it("should handle sentences followed by newlines", () => {
    expect(countSentences("First.\nSecond.\nThird.")).toBe(3);
  });

  it("should handle empty text", () => {
    expect(countSentences("")).toBe(0);
  });

  it("should handle whitespace-only text", () => {
    expect(countSentences("   \n\t  ")).toBe(0);
  });

  it("should handle text without sentence endings", () => {
    expect(countSentences("No ending here")).toBe(0);
  });

  it("should handle sentence at end of text", () => {
    expect(countSentences("Single sentence.")).toBe(1);
  });

  it("should count abbreviations as sentence endings when followed by capital", () => {
    expect(countSentences("Mr. Smith went home. He was tired.")).toBe(3);
  });
});

describe("truncateSectionFromStart", () => {
  it("should truncate from the beginning of a section", () => {
    const context = createContext({
      worldLore: "Some lore here.",
      recentStory:
        "First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here. Sixth sentence here.",
    });

    const result = truncateSectionFromStart(context, "Recent Story", 100, {
      minSentences: 3,
    });

    expect(result).toContain("Recent Story:");
    expect(result).not.toContain("First sentence");
    expect(result).toContain("Sixth sentence here.");
  });

  it("should respect minSentences constraint", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory:
        "One. Two. Three. Four. Five.",
    });

    const result = truncateSectionFromStart(context, "Recent Story", 10, {
      minSentences: 4,
    });

    const sentenceCount = countSentences(result);
    expect(sentenceCount).toBeGreaterThanOrEqual(4);
  });

  it("should return original text if section not found", () => {
    const context = createContext({
      worldLore: "Just lore.",
    });

    const result = truncateSectionFromStart(context, "Recent Story", 50);

    expect(result).toBe(context);
  });

  it("should return original text if already under target", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "Short.",
    });

    const result = truncateSectionFromStart(context, "Recent Story", 1000);

    expect(result).toBe(context);
  });

  it("should preserve section header", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory:
        "First. Second. Third. Fourth. Fifth. Sixth. Seventh. Eighth.",
    });

    const result = truncateSectionFromStart(context, "Recent Story", 50, {
      minSentences: 2,
    });

    expect(result).toContain("Recent Story:");
  });
});

describe("injectWorldLore", () => {
  it("should inject content into World Lore section", () => {
    const context = createContext({
      worldLore: "Existing lore.",
      recentStory: "The story continues. It goes on. And on. And on. The end.",
    });

    const result = injectWorldLore(context, "New card entry.", {
      maxChars: 1000,
    });

    expect(result.injected).toBe(true);
    expect(result.text).toContain("Existing lore.");
    expect(result.text).toContain("New card entry.");
  });

  it("should truncate Recent Story when over budget", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory:
        "First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here. Sixth sentence here. Seventh sentence here. Eighth sentence here.",
    });

    const result = injectWorldLore(context, "A".repeat(50), {
      maxChars: context.length + 20,
      minSentences: 3,
    });

    expect(result.injected).toBe(true);
    expect(result.charsTruncated).toBeGreaterThan(0);
  });

  it("should fail when minSentences would be violated", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "One. Two. Three.",
    });

    const result = injectWorldLore(context, "A".repeat(200), {
      maxChars: context.length + 10,
      minSentences: 3,
    });

    expect(result.injected).toBe(false);
    expect(result.text).toBe(context);
  });

  it("should fail when World Lore section not found", () => {
    const context = "Just some text without sections.";

    const result = injectWorldLore(context, "New content.", {
      maxChars: 1000,
    });

    expect(result.injected).toBe(false);
  });

  it("should skip empty content", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "Story.",
    });

    const result = injectWorldLore(context, "   ", {
      maxChars: 1000,
    });

    expect(result.injected).toBe(false);
    expect(result.text).toBe(context);
  });

  it("should respect budgetPercentage", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "Story here. More story. Even more. Lots of story. The end.",
    });

    const largeContent = "X".repeat(100);

    const result = injectWorldLore(context, largeContent, {
      maxChars: context.length + 200,
      budgetPercentage: 10,
    });

    expect(result.injected).toBe(false);
  });
});

describe("injectStoryCard", () => {
  it("should inject a story card entry", () => {
    const context = createContext({
      worldLore: "Existing lore.",
      recentStory: "Story. More story. Even more. Lots. The end.",
    });

    const card = {
      id: "1",
      entry: "Character description here.",
      title: "Test Character",
      keys: ["character"],
    };

    const result = injectStoryCard(context, card, {
      maxChars: 1000,
    });

    expect(result.injected).toBe(true);
    expect(result.text).toContain("Character description here.");
  });

  it("should skip cards with empty entries", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "Story.",
    });

    const card = {
      id: "1",
      entry: "",
      title: "Empty Card",
    };

    const result = injectStoryCard(context, card, {
      maxChars: 1000,
    });

    expect(result.injected).toBe(false);
  });

  it("should skip cards with undefined entries", () => {
    const context = createContext({
      worldLore: "Lore.",
      recentStory: "Story.",
    });

    const card = {
      id: "1",
      title: "No Entry Card",
    };

    const result = injectStoryCard(context, card, {
      maxChars: 1000,
    });

    expect(result.injected).toBe(false);
  });
});

describe("bracket edge cases", () => {
  describe("Recent Story brackets", () => {
    it("should handle mismatched opening brackets", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "He said [but never finished. The story continues. More text. Even more. The end.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 50, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
      expect(result).toContain("The end.");
    });

    it("should handle mismatched closing brackets", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "The end] she replied. More story. Even more. Lots. Final.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 50, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
    });

    it("should handle nested brackets", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "[outer [inner] still outer]. More text. Even more. Lots. Final.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 50, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
    });

    it("should handle empty brackets", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "Nothing here [] to see. More story. Even more. Lots. Final.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 50, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
    });

    it("should handle brackets spanning sentences", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory:
          "Start of bracket [continues. New sentence.] ends here. More. Final.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 40, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
    });

    it("should handle wikilink-style double brackets", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory:
          "She mentioned [[someone]] in passing. More story. Even more. The end.",
      });

      const result = truncateSectionFromStart(context, "Recent Story", 50, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
    });
  });

  describe("Author's Note brackets", () => {
    it("should handle standard Author's Note format", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "Story here.",
        authorsNote: "keep it dark",
      });

      const sections = parseContextSections(context);
      const authorsNote = sections.find(s => s.name === "Author's Note");

      expect(authorsNote).toBeDefined();
    });

    it("should handle inner brackets in Author's Note", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "Story.",
        authorsNote: "use [mood] tags",
      });

      const result = replaceHeaders(context, {
        "[Author's note:": "## Author's Note:",
      });

      expect(result).toContain("## Author's Note:");
      expect(result).toContain("use [mood] tags");
    });

    it("should handle unclosed Author's Note gracefully", () => {
      const context = `World Lore:
Lore.

Recent Story:
Story.

[Author's note: never closed`;

      const result = replaceHeaders(context, {
        "[Author's note:": "## Author's Note:",
      });

      expect(result).toContain("[Author's note:");
    });

    it("should handle multiple Author's Notes", () => {
      const context = `World Lore:
Lore.

Recent Story:
[Author's note: first] more text [Author's note: second]`;

      const result = replaceHeaders(context, {
        "[Author's note:": "## Author's Note:",
      });

      expect(result).toContain("## Author's Note:");
      expect(result).toContain("first");
    });

    it("should handle brackets after Author's Note", () => {
      const context = createContext({
        worldLore: "Lore.",
        recentStory: "Story.",
        authorsNote: "done",
      });
      const contextWithOrphan = context + " [orphan bracket";

      const result = replaceHeaders(contextWithOrphan, {
        "[Author's note:": "## Author's Note:",
      });

      expect(result).toContain("## Author's Note:");
      expect(result).toContain("[orphan bracket");
    });
  });

  describe("cross-section bracket spans", () => {
    it("should handle bracket opened in Memories closed in Recent Story", () => {
      const context = `World Lore:
Lore.

Memories:
Remember [the old

Recent Story:
days] fondly. More story. Even more. The end.`;

      const result = truncateSectionFromStart(context, "Recent Story", 30, {
        minSentences: 2,
      });

      expect(result).toContain("Recent Story:");
      expect(result).toContain("The end.");
    });
  });

  describe("World Lore brackets", () => {
    it("should handle brackets in card entries", () => {
      const context = createContext({
        worldLore: "The [REDACTED] organization exists.",
        recentStory: "Story. More. Even more. Lots. Final.",
      });

      const result = injectWorldLore(context, "New [classified] info.", {
        maxChars: 1000,
      });

      expect(result.injected).toBe(true);
      expect(result.text).toContain("[REDACTED]");
      expect(result.text).toContain("[classified]");
    });

    it("should handle nested brackets in lore", () => {
      const context = createContext({
        worldLore: "Known as [the [Ancient] Order].",
        recentStory: "Story. More. Even more. Lots. Final.",
      });

      const result = injectWorldLore(context, "Another entry.", {
        maxChars: 1000,
      });

      expect(result.injected).toBe(true);
      expect(result.text).toContain("[the [Ancient] Order]");
    });
  });
});
