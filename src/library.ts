/**
 * FoxTweaks - Unified plugin system for AI Dungeon
 * Consolidates dice rolling, interject, paragraph formatting, redundancy detection, and pronoun replacement
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 */

import { FoxTweaks as FoxTweaksCore } from "./core";

import { DiceRoll } from "./modules/diceroll";
import { Interject } from "./modules/interject";
import { Paragraph } from "./modules/paragraph";
import { Redundancy } from "./modules/redundancy";
import { BetterYou } from "./modules/betteryou";

import { pinAndSortCards, findCard } from "./utils/cards";
import { getLastAction, getLastActionOfType } from "./utils/history";
import { splitIntoSentences, calculateSimilarity } from "./utils/similarity";

const core = new FoxTweaksCore();

core.registerModule(DiceRoll);
core.registerModule(Interject);
core.registerModule(Paragraph);
core.registerModule(Redundancy);
core.registerModule(BetterYou);

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
