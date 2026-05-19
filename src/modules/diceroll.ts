import type { Module, HookContext } from "../types";
import { escapeRegex } from "../utils/string";
import {
  booleanValidator,
  arrayValidator,
  objectValidator,
} from "../utils/validation";

interface CustomSet {
  outcomes: string[];
  words: string[];
}

export interface DiceRollConfig {
  enable: boolean;
  triggers: string[];
  default: string[];
  customSets: Record<string, CustomSet>;
  outcomeLabels: Record<string, string>;
}

export const DiceRoll: Module<DiceRollConfig> = (() => {
  const DEFAULT_OUTCOME_LABELS: Record<string, string> = {
    S: "Critical Success!",
    s: "Success",
    p: "Partial Success",
    f: "Failure",
    F: "Critical Failure!",
  };

  function parseList(value: string): string[] {
    if (value.includes(",")) {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return value.split(/\s+/).filter(Boolean);
  }

  function parseCustomSets(raw: unknown): Record<string, CustomSet> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return {};
    }
    const result: Record<string, CustomSet> = {};
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const set = obj[key];
      if (typeof set !== "object" || set === null || Array.isArray(set)) continue;
      const setObj = set as Record<string, unknown>;
      const outcomesRaw = setObj["outcomes"];
      const wordsRaw = setObj["words"];
      if (typeof outcomesRaw !== "string" || typeof wordsRaw !== "string") continue;
      const outcomes = parseList(outcomesRaw);
      const words = parseList(wordsRaw);
      if (outcomes.length === 0 || words.length === 0) continue;
      result[key] = { outcomes, words };
    }
    return result;
  }

  function validateConfig(raw: Record<string, unknown>): DiceRollConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      triggers: arrayValidator<string>(raw, "triggers"),
      default: arrayValidator<string>(raw, "default"),
      customSets: parseCustomSets(raw["customsets"]),
      outcomeLabels: objectValidator<Record<string, string>>(
        raw,
        "outcomelabels",
        DEFAULT_OUTCOME_LABELS
      ),
    };
  }

  function roll(
    outcomes: string[],
    labels: Record<string, string>
  ): string {
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const label = outcome ? labels[outcome] || outcome : "Unknown";
    return `[🎲 Dice Roll: ${label}]`;
  }

  function onInput(
    text: string,
    config: DiceRollConfig,
    context: HookContext
  ): string {
    if (!config.enable || !config.triggers.length) {
      return text;
    }

    const triggerPattern = config.triggers.map(escapeRegex).join("|");

    for (const [setName, setData] of Object.entries(config.customSets)) {
      if (!setData.words.length || !setData.outcomes.length) continue;

      const modifierPattern = setData.words.map(escapeRegex).join("|");
      const regex = new RegExp(
        `> (You (${modifierPattern}) (${triggerPattern})[^.?!\\n]*[.?!]?)`,
        "i"
      );

      const match = text.match(regex);
      if (match) {
        const outcome = roll(setData.outcomes, config.outcomeLabels);
        return text.replace(match[0], `${match[0].trim()} ${outcome}`);
      }
    }

    const defaultRegex = new RegExp(
      `> (You (${triggerPattern})[^.?!\\n]*[.?!]?)`,
      "i"
    );

    const match = text.match(defaultRegex);
    if (match && config.default.length) {
      const outcome = roll(config.default, config.outcomeLabels);
      return text.replace(match[0], `${match[0].trim()} ${outcome}`);
    }

    return text;
  }

  function migrateConfigSection(sectionText: string): string {
    if (/^\s*CustomSets:/m.test(sectionText)) {
      return sectionText;
    }

    const setNamePattern = /^([A-Za-z][A-Za-z0-9_]*):[ \t]*([^\n#]+?)[ \t]*(#[^\n]*)?$/gm;
    const sets = new Map<string, { outcomes?: string; words?: string }>();
    const linesToRemove = new Set<number>();
    const lines = sectionText.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (/^\s/.test(line)) continue;
      setNamePattern.lastIndex = 0;
      const match = setNamePattern.exec(line);
      if (!match) continue;
      const key = match[1];
      const value = match[2];
      if (!key || !value) continue;

      const reservedKeys = new Set([
        "Enable",
        "Triggers",
        "Default",
        "OutcomeLabels",
        "CustomSets",
      ]);
      if (reservedKeys.has(key)) continue;

      if (key.endsWith("Words")) {
        const baseName = key.slice(0, -"Words".length);
        if (!baseName) continue;
        const entry = sets.get(baseName) ?? {};
        entry.words = value.trim();
        sets.set(baseName, entry);
        linesToRemove.add(i);
      } else {
        const entry = sets.get(key) ?? {};
        entry.outcomes = value.trim();
        sets.set(key, entry);
        linesToRemove.add(i);
      }
    }

    const customSets: Array<{ name: string; outcomes: string; words: string }> = [];
    for (const [name, data] of sets) {
      if (data.outcomes && data.words) {
        customSets.push({ name, outcomes: data.outcomes, words: data.words });
      }
    }

    if (customSets.length === 0) {
      return sectionText;
    }

    const remainingLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!linesToRemove.has(i)) {
        const line = lines[i];
        if (line !== undefined) remainingLines.push(line);
      }
    }

    while (
      remainingLines.length > 0 &&
      remainingLines[remainingLines.length - 1]?.trim() === ""
    ) {
      remainingLines.pop();
    }

    const customSetsBlock = ["CustomSets:"];
    for (const set of customSets) {
      customSetsBlock.push(`  ${set.name}:`);
      customSetsBlock.push(`    Outcomes: ${set.outcomes}`);
      customSetsBlock.push(`    Words: ${set.words}`);
    }

    return remainingLines.join("\n") + "\n" + customSetsBlock.join("\n");
  }

  return {
    name: "dice",
    configSection: `--- Dice ---
Enable: true  # Enable/disable dice rolling
# Trigger words that activate dice rolls:
Triggers: try, attempt, cast, attack, shoot, throw, brace yourself
# Default probability distribution (S=Crit Success, s=Success, p=Partial, f=Fail, F=Crit Fail):
Default: S s s s p f f F
# Outcome labels (customize the text for each outcome):
OutcomeLabels:
  S: Critical Success!
  s: Success
  p: Partial Success
  f: Failure
  F: Critical Failure!
# Custom probability sets (Words trigger the matching Outcomes distribution):
CustomSets:
  Confident:
    Outcomes: S S s s s p p f f
    Words: assuredly, confidently, doubtlessly, skillfully
  Unconfident:
    Outcomes: s s p p f f f F F
    Words: clumsily, tentatively, doubtfully, hesitantly, haphazardly`,
    validateConfig,
    hooks: {
      onInput,
    },
    migrateConfigSection,
  };
})();
