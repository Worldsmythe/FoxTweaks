import { describe, test, expect } from "bun:test";
import { parseConfig } from "./config";
import type { Module } from "./types";
import { DiceRoll, type DiceRollConfig } from "./modules/diceroll";
import { Interject, type InterjectConfig } from "./modules/interject";
import { Paragraph, type ParagraphConfig } from "./modules/paragraph";
import { Redundancy, type RedundancyConfig } from "./modules/redundancy";
import { BetterYou, type BetterYouConfig } from "./modules/betteryou";
import {
  MarkdownHeaders,
  type MarkdownHeadersConfig,
} from "./modules/markdownHeaders";
import {
  NarrativeChecklist,
  type NarrativeChecklistConfig,
} from "./modules/narrativeChecklist";

interface TestConfig {
  dice: DiceRollConfig;
  interject: InterjectConfig;
  paragraph: ParagraphConfig;
  redundancy: RedundancyConfig;
  betterYou: BetterYouConfig;
  markdownHeaders: MarkdownHeadersConfig;
  narrativeChecklist: NarrativeChecklistConfig;
  [key: string]: unknown;
}

const modules = [
  DiceRoll,
  Interject,
  Paragraph,
  Redundancy,
  BetterYou,
  MarkdownHeaders,
  NarrativeChecklist,
] as Module<unknown>[];

describe("parseConfig - Full String Parsing", () => {
  test("parses DiceRoll default config string", () => {
    const config = parseConfig<TestConfig>(DiceRoll.configSection, modules);
    expect(config.dice.enable).toBe(true);
  });

  test("parses Interject default config string", () => {
    const config = parseConfig<TestConfig>(Interject.configSection, modules);
    expect(config.interject.enable).toBe(true);
    expect(config.interject.maxTurns).toBe(3);
    expect(config.interject.remainingTurns).toBe(0);
  });

  test("parses Paragraph default config string", () => {
    const config = parseConfig<TestConfig>(Paragraph.configSection, modules);
    expect(config.paragraph.enable).toBe(true);
    expect(config.paragraph.formattingType).toBe("none");
    expect(config.paragraph.indentParagraphs).toBe(false);
  });

  test("parses Redundancy default config string", () => {
    const config = parseConfig<TestConfig>(Redundancy.configSection, modules);
    expect(config.redundancy.enable).toBe(true);
    expect(config.redundancy.similarityThreshold).toBe(70);
  });

  test("parses BetterYou default config string", () => {
    const config = parseConfig<TestConfig>(BetterYou.configSection, modules);
    expect(config.betterYou.enable).toBe(true);
    expect(config.betterYou.replacements).toEqual({
      me: "you",
      mine: "yours",
      Me: "You",
      Mine: "Yours",
    });
    expect(config.betterYou.patterns).toEqual({
      ". you": ". You",
      '." you': '." You',
    });
  });

  test("parses MarkdownHeaders default config string", () => {
    const config = parseConfig<TestConfig>(
      MarkdownHeaders.configSection,
      modules
    );
    expect(config.markdownHeaders.enable).toBe(true);
    expect(config.markdownHeaders.headerLevel).toBe("##");
  });

  test("parses NarrativeChecklist default config string", () => {
    const config = parseConfig<TestConfig>(
      NarrativeChecklist.configSection,
      modules
    );
    expect(config.narrativeChecklist.enable).toBe(true);
    expect(config.narrativeChecklist.maxTurnsBeforeCheck).toBe(50);
    expect(config.narrativeChecklist.remainingTurns).toBe(50);
    expect(config.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(config.narrativeChecklist.minContextChars).toBe(2000);
  });

  test("parses all modules combined", () => {
    const allConfigs = modules.map((m) => m.configSection).join("\n\n");
    const config = parseConfig<TestConfig>(allConfigs, modules);

    expect(config.dice.enable).toBe(true);
    expect(config.interject.enable).toBe(true);
    expect(config.paragraph.enable).toBe(true);
    expect(config.redundancy.enable).toBe(true);
    expect(config.betterYou.enable).toBe(true);
    expect(config.markdownHeaders.enable).toBe(true);
    expect(config.narrativeChecklist.enable).toBe(true);
  });

  test("parses user-modified config with comments (PascalCase to lowercase)", () => {
    const userConfig = `--- Narrative Checklist ---
Enable: true  # Enable narrative checklist tracking
MaxTurnsBeforeCheck: 10  # Check at most every 10 turns
RemainingTurns: 5  # 5 turns until next check
AlwaysIncludeInContext: false  # Don't always include
MinContextChars: 1000  # Keep 1000 chars of recent story`;

    const config = parseConfig<TestConfig>(userConfig, modules);
    expect(config.narrativeChecklist.enable).toBe(true);
    expect(config.narrativeChecklist.maxTurnsBeforeCheck).toBe(10);
    expect(config.narrativeChecklist.remainingTurns).toBe(5);
    expect(config.narrativeChecklist.alwaysIncludeInContext).toBe(false);
    expect(config.narrativeChecklist.minContextChars).toBe(1000);
  });

  test("handles config with no spaces after colon", () => {
    const config = parseConfig<TestConfig>(
      `--- Redundancy ---
Enable:true
SimilarityThreshold:85`,
      modules
    );
    expect(config.redundancy.enable).toBe(true);
    expect(config.redundancy.similarityThreshold).toBe(85);
  });

  test("handles config with extra whitespace", () => {
    const config = parseConfig<TestConfig>(
      `--- Interject ---
Enable:    true
MaxTurns:     5
RemainingTurns:  2`,
      modules
    );
    expect(config.interject.enable).toBe(true);
    expect(config.interject.maxTurns).toBe(5);
    expect(config.interject.remainingTurns).toBe(2);
  });

  test("ignores invalid section names", () => {
    const config = parseConfig<TestConfig>(
      `--- Unknown Module ---
Enable: true
SomeSetting: 123`,
      modules
    );
    expect(config.unknownModule).toBeUndefined();
  });

  test("lowercase key names work correctly", () => {
    const config = parseConfig<TestConfig>(
      `--- Redundancy ---
enable: true
similaritythreshold: 85`,
      modules
    );
    expect(config.redundancy.enable).toBe(true);
    expect(config.redundancy.similarityThreshold).toBe(85);
  });

  test("parses full default config from README", () => {
    const defaultConfig = `--- Dice ---
Enable: true  # Enable/disable dice rolling
# Trigger words that activate dice rolls:
Triggers: try, attempt, cast, attack, shoot, throw, brace yourself
# Default probability distribution (S=Crit Success, s=Success, p=Partial, f=Fail, F=Crit Fail):
Default: S s s s p f f F
# Custom probability sets:
Confident: S S s s s p p f f
Unconfident: s s p p f f f F F
# Words that trigger custom sets:
ConfidentWords: assuredly, confidently, doubtlessly, skillfully
UnconfidentWords: clumsily, tentatively, doubtfully, hesitantly, haphazardly

--- Interject ---
Enable: true  # Enable/disable interject feature
MaxTurns: 3  # Number of turns to show the interjected message
RemainingTurns: 0  # Countdown (managed automatically)

--- Paragraph ---
Enable: true  # Enable/disable paragraph formatting
# FormattingType options: none, basic, empty-line, newline
# - none: No formatting
# - basic: Converts multiple spaces/newlines to double newlines
# - empty-line: Basic + adds spacing before quotes (except after commas)
# - newline: Basic + newlines before quotes
FormattingType: none
IndentParagraphs: false  # Add 4-space indents to paragraphs

--- Redundancy ---
Enable: true  # Enable/disable redundancy detection and merging
# Similarity threshold (0-100) for fuzzy sentence matching:
SimilarityThreshold: 70

--- Better You ---
Enable: true  # Enable/disable pronoun replacements
# Replace words outside of dialogue (respects word boundaries):
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours
  . you: . You
  ." you: ." You

--- Markdown Headers ---
Enable: true  # Replace plain text headers with markdown
HeaderLevel: ##  # Markdown header level (## or ###)

--- Narrative Checklist ---
Enable: true  # Enable narrative checklist tracking
MinTurnsBeforeCheck: 50  # Minimum turns between AI completion checks
RemainingTurns: 50  # Turns remaining until next check
AlwaysIncludeInContext: true  # Always include checklist in context
MinContextChars: 2000  # Minimum characters to preserve for recent story`;

    const config = parseConfig<TestConfig>(defaultConfig, modules);

    // Dice
    expect(config.dice.enable).toBe(true);
    expect(config.dice.triggers).toEqual([
      "try",
      "attempt",
      "cast",
      "attack",
      "shoot",
      "throw",
      "brace yourself",
    ]);
    expect(config.dice.default).toEqual([
      "S",
      "s",
      "s",
      "s",
      "p",
      "f",
      "f",
      "F",
    ]);

    // Interject
    expect(config.interject.enable).toBe(true);
    expect(config.interject.maxTurns).toBe(3);
    expect(config.interject.remainingTurns).toBe(0);

    // Paragraph
    expect(config.paragraph.enable).toBe(true);
    expect(config.paragraph.formattingType).toBe("none");
    expect(config.paragraph.indentParagraphs).toBe(false);

    // Redundancy
    expect(config.redundancy.enable).toBe(true);
    expect(config.redundancy.similarityThreshold).toBe(70);

    // BetterYou
    expect(config.betterYou.enable).toBe(true);
    expect(config.betterYou.replacements).toEqual({
      me: "you",
      mine: "yours",
      Me: "You",
      Mine: "Yours",
      ". you": ". You",
      '." you': '." You',
    });

    // MarkdownHeaders
    expect(config.markdownHeaders.enable).toBe(true);
    expect(config.markdownHeaders.headerLevel).toBe("##");

    // NarrativeChecklist
    expect(config.narrativeChecklist.enable).toBe(true);
    expect(config.narrativeChecklist.maxTurnsBeforeCheck).toBe(50);
    expect(config.narrativeChecklist.remainingTurns).toBe(50);
    expect(config.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(config.narrativeChecklist.minContextChars).toBe(2000);
  });
});
