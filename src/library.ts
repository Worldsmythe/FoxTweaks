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
 * - Configurable context formatting
 * - Context manipulation utilities
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 */

import { FoxTweaks as FoxTweaksCore } from "./core";

import { DiceRoll } from "./modules/diceroll";
import { Interject } from "./modules/interject";
import { WordBoundaryTriggers } from "./modules/wordBoundaryTriggers";
import { TreeCards } from "./modules/treeCards";
import { SectionInjection } from "./modules/sectionInjection";
import { Paragraph } from "./modules/paragraph";
import { Redundancy } from "./modules/redundancy";
import { BetterYou } from "./modules/betteryou";
import { Context } from "./modules/context";
import { NarrativeChecklist } from "./modules/narrativeChecklist";
import { DebugStart, DebugEnd } from "./modules/debug";

import { pinAndSortCards, findCard } from "./utils/storyCardHelpers";
import { getLastAction, getLastActionOfType } from "./utils/historyHelpers";
import { splitIntoSentences, calculateSimilarity } from "./utils/similarity";

const core = new FoxTweaksCore();

core.registerModule(DebugStart);
core.registerModule(DiceRoll);
core.registerModule(Interject);
core.registerModule(WordBoundaryTriggers);
core.registerModule(TreeCards);
core.registerModule(SectionInjection);
core.registerModule(Paragraph);
core.registerModule(Redundancy);
core.registerModule(BetterYou);
core.registerModule(NarrativeChecklist);
core.registerModule(Context);
core.registerModule(DebugEnd);

const hooks = core.createHooks();

export const FoxTweaks = {
  Hooks: {
    onInput: hooks.onInput,
    onContext: hooks.onContext,
    onOutput: hooks.onOutput,
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
