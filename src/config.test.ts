import { describe, test, expect } from "bun:test";
import { parseConfig } from "./config";
import type { Module } from "./types";
import { DiceRoll, type DiceRollConfig } from "./modules/diceroll";
import { Interject, type InterjectConfig } from "./modules/interject";
import { Paragraph, type ParagraphConfig } from "./modules/paragraph";
import { Redundancy, type RedundancyConfig } from "./modules/redundancy";
import { BetterYou, type BetterYouConfig } from "./modules/betteryou";
import { Context, type ContextConfig } from "./modules/context";
import {
  NarrativeChecklist,
  type NarrativeChecklistConfig,
} from "./modules/narrativeChecklist";
import {
  RandomNames,
  type RandomNamesConfig,
} from "./modules/randomNames";

interface TestConfig {
  dice: DiceRollConfig;
  interject: InterjectConfig;
  paragraph: ParagraphConfig;
  redundancy: RedundancyConfig;
  betterYou: BetterYouConfig;
  context: ContextConfig;
  narrativeChecklist: NarrativeChecklistConfig;
  randomNames: RandomNamesConfig;
  [key: string]: unknown;
}

const modules = [
  DiceRoll,
  Interject,
  Paragraph,
  Redundancy,
  BetterYou,
  Context,
  NarrativeChecklist,
  RandomNames,
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
      mine: "yours",
      Mine: "Yours",
    });
    expect(config.betterYou.patterns).toEqual({
      ". you": ". You",
      '." you': '." You',
    });
  });

  test("parses Context default config string", () => {
    const config = parseConfig<TestConfig>(
      Context.configSection,
      modules
    );
    expect(config.context.enable).toBe(false);
    expect(config.context.headerFormat).toBe("plain");
    expect(config.context.markdownLevel).toBe("##");
    expect(config.context.authorsNoteFormat).toBe("bracket");
    expect(config.context.minRecentStoryPercent).toBe(30);
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
    expect(config.context.enable).toBe(false);
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
# Custom probability sets (Words trigger the matching Outcomes distribution):
CustomSets:
  Confident:
    Outcomes: S S s s s p p f f
    Words: assuredly, confidently, doubtlessly, skillfully
  Unconfident:
    Outcomes: s s p p f f f F F
    Words: clumsily, tentatively, doubtfully, hesitantly, haphazardly

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
    expect(config.dice.customSets["confident"]).toEqual({
      outcomes: ["S", "S", "s", "s", "s", "p", "p", "f", "f"],
      words: ["assuredly", "confidently", "doubtlessly", "skillfully"],
    });
    expect(config.dice.customSets["unconfident"]).toEqual({
      outcomes: ["s", "s", "p", "p", "f", "f", "f", "F", "F"],
      words: ["clumsily", "tentatively", "doubtfully", "hesitantly", "haphazardly"],
    });

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

    // Context
    expect(config.context.enable).toBe(false);
    expect(config.context.headerFormat).toBe("plain");
    expect(config.context.markdownLevel).toBe("##");
    expect(config.context.authorsNoteFormat).toBe("bracket");
    expect(config.context.minRecentStoryPercent).toBe(30);

    // NarrativeChecklist
    expect(config.narrativeChecklist.enable).toBe(true);
    expect(config.narrativeChecklist.maxTurnsBeforeCheck).toBe(50);
    expect(config.narrativeChecklist.remainingTurns).toBe(50);
    expect(config.narrativeChecklist.alwaysIncludeInContext).toBe(true);
    expect(config.narrativeChecklist.minContextChars).toBe(2000);
  });

  test("preserves case for dice outcomeLabels keys", () => {
    const configString = `--- Dice ---
Enable: true
Triggers: try
Default: S s p f F
OutcomeLabels:
  S: Critical Success!
  s: Success
  p: Partial Success
  f: Failure
  F: Critical Failure!`;

    const config = parseConfig<TestConfig>(configString, modules);
    expect(config.dice.outcomeLabels.S).toBe("Critical Success!");
    expect(config.dice.outcomeLabels.s).toBe("Success");
    expect(config.dice.outcomeLabels.p).toBe("Partial Success");
    expect(config.dice.outcomeLabels.f).toBe("Failure");
    expect(config.dice.outcomeLabels.F).toBe("Critical Failure!");
  });

  test("matches multi-word module names with spaces in section headers", () => {
    const config = parseConfig<TestConfig>(
      `--- Random Names ---
Enable: true
SectionHeader: NPC Names
Names: [{"prefix": "Test", "count": 3, "id": "englishMasculine"}]`,
      modules
    );
    expect(config.randomNames.enable).toBe(true);
    expect(config.randomNames.sectionHeader).toBe("NPC Names");
    expect(config.randomNames.names.length).toBe(1);
    expect(config.randomNames.names[0]?.prefix).toBe("Test");
    expect(config.randomNames.names[0]?.count).toBe(3);
    expect(config.randomNames.names[0]?.id).toBe("englishMasculine");
  });

  test("parses two-level nested config for replacement groups", () => {
    const config = parseConfig<TestConfig>(
      `--- Random Names ---
Enable: true
Replacements:
  Group1:
    ReplaceNames: Elara, Lyra
    ReplaceFrom: englishFeminine
    Segments: 1
  Group2:
    ReplaceNames: Voss, Vance
    ReplaceFrom: englishMasculine
    Segments: -1`,
      modules
    );
    const replacements = config.randomNames.replacements;
    expect(replacements.length).toBe(2);
    expect(replacements[0]?.patterns).toEqual(["Elara", "Lyra"]);
    expect(replacements[0]?.bankId).toBe("englishFeminine");
    expect(replacements[0]?.segments).toBe(1);
    expect(replacements[1]?.patterns).toEqual(["Voss", "Vance"]);
    expect(replacements[1]?.bankId).toBe("englishMasculine");
    expect(replacements[1]?.segments).toBe(-1);
  });

  test("parses Names from two-level nested config", () => {
    const config = parseConfig<TestConfig>(
      `--- Random Names ---
Enable: true
Names:
  English Masculine:
    Count: 3
    Id: englishMasculine
  English Feminine:
    Count: 2
    Id: englishFeminine`,
      modules
    );
    expect(config.randomNames.names.length).toBe(2);
    expect(config.randomNames.names[0]?.prefix).toBe("English Masculine");
    expect(config.randomNames.names[0]?.count).toBe(3);
    expect(config.randomNames.names[0]?.id).toBe("englishMasculine");
    expect(config.randomNames.names[1]?.prefix).toBe("English Feminine");
    expect(config.randomNames.names[1]?.count).toBe(2);
  });
});
