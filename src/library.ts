/**
 * FoxTweaks - Unified plugin system for AI Dungeon
 *
 * Features:
 * - Dice rolling with custom probability sets
 * - Paragraph formatting and indentation
 * - Redundancy detection and merging
 * - Pronoun replacement (Better You)
 * - Random names (Random Names)
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 */

import { FoxTweaks as FoxTweaksCore } from "./core";

import { DiceRoll } from "./modules/diceroll";
import { Paragraph } from "./modules/paragraph";
import { Redundancy } from "./modules/redundancy";
import { BetterYou } from "./modules/betteryou";
import { DebugStart, DebugEnd } from "./modules/debug";
import { RandomNames } from "./modules/randomNames";

import { pinAndSortCards, findCard } from "./utils/storyCardHelpers";
import { getLastAction, getLastActionOfType } from "./utils/historyHelpers";
import { splitIntoSentences, calculateSimilarity } from "./utils/similarity";

const core = new FoxTweaksCore();

core.registerModule(DebugStart);
core.registerModule(DiceRoll);
core.registerModule(Paragraph);
core.registerModule(Redundancy);
core.registerModule(BetterYou);
core.registerModule(RandomNames);
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
