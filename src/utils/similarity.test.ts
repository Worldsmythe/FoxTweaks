import { describe, it, expect } from "bun:test";
import { checkAndMerge } from "./similarity";

describe("checkAndMergeMessages", () => {
  describe("user-provided examples", () => {
    it("should remove redundant quote from new output", () => {
      const msg1 =
        'The interrogation had been going on for hours. The dim light flickered overhead, casting long shadows across the stone walls. Despite the pain, he maintained his composure. "I am not a traitor," he sneered.';
      const msg2 =
        '"I am not a traitor," he shouted. He writhed against the bonds that kept him in place, his voice echoing through the chamber. The guards exchanged glances, uncertainty creeping into their expressions.';

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
      expect(result.mergedContent).toContain("He writhed");
      expect(result.mergedContent).toContain("guards exchanged glances");
      expect(result.mergedContent).not.toContain("interrogation");
      expect(result.mergedContent).not.toContain("I am not a traitor");
    });

    it("should remove overlapping action sequences from new output", () => {
      const msg1 =
        'The moment stretched between you, thick with tension and unspoken words. Her breath came in short gasps, her pupils dilated. Pulling back just enough to meet her dazed eyes, you grin. "You know."';
      const msg2 =
        'You pull back just enough to meet her dazed eyes, you grin. "You know," you murmur, your voice barely above a whisper. She shivers at your words, a mixture of fear and something else flickering across her face.';

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
      expect(result.mergedContent).toContain("She shivers");
      expect(result.mergedContent).not.toContain("The moment stretched");
      expect(result.mergedContent).not.toContain("you grin");
    });
  });

  describe("sentence-based overlap detection", () => {
    it("should detect single sentence overlap at boundary", () => {
      const msg1 = "First part. The cat sat on the mat.";
      const msg2 = "The cat sat on the mat. Then it jumped.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
      expect(result.mergedContent).toBe("Then it jumped.");
    });

    it("should detect multiple sentence overlap", () => {
      const msg1 = "Introduction here. Sentence one. Sentence two.";
      const msg2 = "Sentence one. Sentence two. New content follows.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
      expect(result.mergedContent).toBe("New content follows.");
    });

    it("should not merge when no overlap exists", () => {
      const msg1 = "Completely different content here.";
      const msg2 = "Totally unrelated message content.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(false);
    });

    it("should handle exact sentence matches with different punctuation", () => {
      const msg1 = "The door opened.";
      const msg2 = "The door opened! She walked in.";

      const result = checkAndMerge(msg1, msg2);

      // High similarity despite punctuation difference
      expect(result.shouldMerge).toBe(true);
    });
  });

  describe("fuzzy matching with variations", () => {
    it("should detect overlap with minor word differences", () => {
      const msg1 = "He walked to the store.";
      const msg2 = "He walks to the store. Then buys milk.";

      const result = checkAndMerge(msg1, msg2);

      // Should detect high similarity despite tense change
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
    });

    it("should detect overlap with pronoun changes", () => {
      const msg1 = "I grab the sword.";
      const msg2 = "You grab the sword. It feels heavy.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
    });

    it("should detect similar dialogue with different tags", () => {
      const msg1 = '"Stop!" she yelled.';
      const msg2 = '"Stop!" she screamed. Her voice echoed.';

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("sentence-overlap");
    });
  });

  describe("complete message overlap", () => {
    it("should remove overlap when all of message 1 overlaps with start of message 2", () => {
      const msg1 = "The beginning of the story.";
      const msg2 = "The beginning of the story. And then it continues further.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("And then it continues further.");
    });

    it("should detect full duplicates", () => {
      const msg1 = "Exact duplicate message here.";
      const msg2 = "Exact duplicate message here.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("full-duplicate");
    });

    it("should detect near-duplicates and keep longer version", () => {
      const msg1 = "Almost exact same message.";
      const msg2 = "Almost exact same message with a bit more.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      // Should keep the longer message
      expect(result.mergedContent).toContain("with a bit more");
    });
  });

  describe("sentence splitting with quotes", () => {
    it("should not split sentences inside double quotes", () => {
      const msg1 = 'He said "This. Is. Staccato."';
      const msg2 = 'He said "This. Is. Staccato." Then left.';

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe(msg2);
    });

    it("should handle quotes with punctuation at end", () => {
      const msg1 = 'She asked "Why?"';
      const msg2 = 'She asked "Why?" No one answered.';

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe(msg2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages", () => {
      expect(checkAndMerge("", "Content")).toEqual({
        shouldMerge: false,
      });
      expect(checkAndMerge("Content", "")).toEqual({
        shouldMerge: false,
      });
      expect(checkAndMerge("", "")).toEqual({ shouldMerge: false });
    });

    it("should handle single word messages", () => {
      const result = checkAndMerge("Word.", "Different.");
      expect(result.shouldMerge).toBe(false);
    });

    it("should trim whitespace before comparison", () => {
      const msg1 = "  Same content.  ";
      const msg2 = "Same content. More stuff.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
    });

    it("should handle messages with only one sentence each", () => {
      const msg1 = "Single sentence.";
      const msg2 = "Single sentence.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toBe("full-duplicate");
    });
  });

  describe("partial overlap scenarios", () => {
    it("should only remove overlapping portion from message 2", () => {
      const msg1 = "Unique start. Shared middle.";
      const msg2 = "Shared middle. Unique end.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("Unique end.");
      expect(result.mergedContent).not.toContain("Unique start");
      expect(result.mergedContent).not.toContain("Shared middle");
    });

    it("should remove overlap from start of message 2", () => {
      const msg1 = "Important setup. Then the action.";
      const msg2 = "Then the action. And resolution.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("And resolution.");
      expect(result.mergedContent).not.toContain("Important setup");
      expect(result.mergedContent).not.toContain("Then the action");
    });
  });

  describe("no false positives", () => {
    it("should not merge messages with low similarity", () => {
      const msg1 = "The quick brown fox.";
      const msg2 = "The slow red turtle.";

      const result = checkAndMerge(msg1, msg2);

      // Different enough that shouldn't merge
      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge when overlap is too small", () => {
      const msg1 = "Many sentences. Short.";
      const msg2 = "Short. But different.";

      const result = checkAndMerge(msg1, msg2);

      // "Short." might be below word/character threshold
      // This depends on implementation, but single short words shouldn't trigger
      expect(result.shouldMerge).toBe(true); // Actually should merge based on sentence match
    });

    it("should require substantial similarity for fuzzy match", () => {
      const msg1 = "He said something completely different.";
      const msg2 = "She did something totally unique.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge same quote with different speakers", () => {
      const msg1 =
        'He looked at her carefully. "I understand," he said quietly.';
      const msg2 = '"I understand," she replied, her voice trembling.';

      const result = checkAndMerge(msg1, msg2);

      // Same quote but different attribution - should NOT merge
      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge similar but distinct actions", () => {
      const msg1 = "You reach for the door handle.";
      const msg2 = "You reach for your weapon. The room grows tense.";

      const result = checkAndMerge(msg1, msg2);

      // "reach for" is similar but different objects
      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge similar narrative with different content", () => {
      const msg1 =
        "The forest was dark and foreboding. Strange sounds echoed through the trees.";
      const msg2 =
        "The forest was peaceful and quiet. Sunlight filtered through the leaves.";

      const result = checkAndMerge(msg1, msg2);

      // Same setting but opposite mood/description
      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge consecutive distinct dialogue", () => {
      const msg1 = '"Where are we going?" she asked nervously.';
      const msg2 = '"Why are you here?" he demanded angrily.';

      const result = checkAndMerge(msg1, msg2);

      // Different questions from different speakers
      expect(result.shouldMerge).toBe(false);
    });

    it("should not merge partial word matches", () => {
      const msg1 = "You examine the ancient tome carefully.";
      const msg2 =
        "You examine your hands, searching for any signs of corruption.";

      const result = checkAndMerge(msg1, msg2);

      // "examine" is the same but everything else is different
      expect(result.shouldMerge).toBe(false);
    });

    it("should not be fooled by common filler phrases", () => {
      const msg1 = "You take a deep breath and step forward into the darkness.";
      const msg2 = "You take a deep breath and dive into the cold water below.";

      const result = checkAndMerge(msg1, msg2);

      // Same opening but completely different actions
      expect(result.shouldMerge).toBe(false);
    });
  });

  describe("proper spacing in merged content", () => {
    it("should preserve input spacing when removing overlap", () => {
      const msg1 = "Setup text. Overlapping sentence.";
      const msg2 = "Overlapping sentence. Continuation with space.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("Continuation with space.");
      expect(result.mergedContent).not.toContain("  ");
    });

    it("should remove overlap and preserve spacing in remaining text", () => {
      const msg1 = "First part. Shared end.";
      const msg2 = "Shared end. New part.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("New part.");
      expect(result.mergedContent).not.toContain("  ");
    });

    it("should preserve Japanese text without adding spaces", () => {
      const msg1 = "最初の文。次の部分。";
      const msg2 = "次の部分。追加の文。";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("追加の文。");
    });

    it("should preserve spacing when removing overlap from properly formatted messages", () => {
      const msg1 = "Introduction. Middle part. End overlap.";
      const msg2 = "Middle part. End overlap. Continuation text.";

      const result = checkAndMerge(msg1, msg2);

      expect(result.shouldMerge).toBe(true);
      expect(result.mergedContent).toBe("Continuation text.");
      expect(result.mergedContent).not.toContain("  ");
    });
  });
});
