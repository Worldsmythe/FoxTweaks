import type { Module, HookParams, HookReturn, HookContext } from "../types";
import { escapeRegex } from "../utils/string";
import { booleanValidator, arrayValidator, objectValidator } from "../utils/validation";

interface CustomSet {
  outcomes: string[];
  words: string[];
}

export interface DiceRollConfig {
  enable: boolean;
  triggers: string[];
  default: string[];
  customSets: Record<string, CustomSet>;
}

export const DiceRoll: Module<DiceRollConfig> = (() => {
  interface DiceRollOutcomes {
    S: string;
    s: string;
    p: string;
    f: string;
    F: string;
    [key: string]: string;
  }

  const OUTCOME_LABELS: DiceRollOutcomes = {
    S: "Critical Success!",
    s: "Success",
    p: "Partial Success",
    f: "Failure",
    F: "Critical Failure!",
  };

  function validateConfig(raw: Record<string, unknown>): DiceRollConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      triggers: arrayValidator<string>(raw, "triggers"),
      default: arrayValidator<string>(raw, "default"),
      customSets: objectValidator<Record<string, CustomSet>>(raw, "customSets"),
    };
  }

  function roll(outcomes: string[]): string {
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const label = outcome ? OUTCOME_LABELS[outcome] || outcome : "Unknown";
    return `[🎲 Dice Roll: ${label}]`;
  }

  function onInput(params: HookParams, config: DiceRollConfig, context: HookContext): HookReturn {
    if (!config.enable || !config.triggers.length) {
      return params;
    }

    let { text } = params;
    const triggerPattern = config.triggers.map(escapeRegex).join("|");

    for (const [setName, setData] of Object.entries(config.customSets)) {
      if (!setData.words.length || !setData.outcomes.length) continue;

      const modifierPattern = setData.words.map(escapeRegex).join("|");
      const regex = new RegExp(
        `> (You (${modifierPattern}) (${triggerPattern})[^.?!]*[.?!])`,
        "i"
      );

      const match = text.match(regex);
      if (match) {
        const outcome = roll(setData.outcomes);
        text = text.replace(match[0], `${match[0].trim()} ${outcome}`);
        return { ...params, text };
      }
    }

    const defaultRegex = new RegExp(
      `> (You (${triggerPattern})[^.?!]*[.?!])`,
      "i"
    );

    const match = text.match(defaultRegex);
    if (match && config.default.length) {
      const outcome = roll(config.default);
      text = text.replace(match[0], `${match[0].trim()} ${outcome}`);
    }

    return { ...params, text };
  }

  return {
    name: "dice",
    configSection: `--- Dice ---
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
UnconfidentWords: clumsily, tentatively, doubtfully, hesitantly, haphazardly`,
    validateConfig,
    hooks: {
      onInput,
    },
  };
})();
