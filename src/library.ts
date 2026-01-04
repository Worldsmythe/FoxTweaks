/**
 * FoxTweaks - Unified plugin system for AI Dungeon
 *
 * Features:
 * - Dice rolling with custom probability sets
 * - Temporary AI guidance messages (Interject)
 * - Paragraph formatting and indentation
 * - Redundancy detection and merging
 * - Pronoun replacement (Better You)
 * - Narrative checklist with AI-powered completion detection
 * - Markdown header formatting
 * - Context manipulation utilities
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 *   Context reformat: text = FoxTweaks.Hooks.reformatContext(text);
 */

import { FoxTweaks as FoxTweaksCore } from "./core";

import { DiceRoll } from "./modules/diceroll";
import { Interject } from "./modules/interject";
import { Paragraph } from "./modules/paragraph";
import { Redundancy } from "./modules/redundancy";
import { BetterYou } from "./modules/betteryou";
import { MarkdownHeaders } from "./modules/markdownHeaders";
import { NarrativeChecklist } from "./modules/narrativeChecklist";
import { TreeCards } from "./modules/treeCards";
import { DebugStart, DebugEnd } from "./modules/debug";

import { pinAndSortCards, findCard } from "./utils/storyCardHelpers";
import { getLastAction, getLastActionOfType } from "./utils/historyHelpers";
import { splitIntoSentences, calculateSimilarity } from "./utils/similarity";

const core = new FoxTweaksCore();

core.registerModule(DebugStart);
core.registerModule(DiceRoll);
core.registerModule(Interject);
core.registerModule(TreeCards);
core.registerModule(Paragraph);
core.registerModule(Redundancy);
core.registerModule(BetterYou);
core.registerModule(NarrativeChecklist);
core.registerModule(MarkdownHeaders);
core.registerModule(DebugEnd);

const hooks = core.createHooks();

export const FoxTweaks = {
  Hooks: {
    onInput: hooks.onInput,
    onContext: hooks.onContext,
    onOutput: hooks.onOutput,
    reformatContext: hooks.reformatContext,
  },
  Utils: {
    pinAndSortCards,
    findCard,
    getLastAction,
    getLastActionOfType,
    splitIntoSentences,
    calculateSimilarity,
  },
};

export default FoxTweaks;
