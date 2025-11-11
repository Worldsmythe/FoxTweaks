import type { Module, HookParams, HookReturn, StoryCard, HookContext } from "../types";
import { findCard } from "../utils/cards";
import { booleanValidator, numberValidator } from "../utils/validation";

export interface InterjectConfig {
  enable: boolean;
  maxTurns: number;
  remainingTurns: number;
}

export function getDefaultInterjectEntry(): string {
  return `Type something here to emphasize it to the AI:

    `;
}

export const Interject: Module<InterjectConfig> = (() => {
  const CARD_TITLE = "FoxTweaks Config";

  function validateConfig(raw: Record<string, unknown>): InterjectConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      maxTurns: numberValidator(raw, "maxTurns", { min: 1 }, 3),
      remainingTurns: numberValidator(raw, "remainingTurns", { min: 0 }, 0),
    };
  }

  function getContent(card: StoryCard): string {
    const lines = (card.entry || "").split("\n");
    let contentStartIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.toLowerCase().includes("type something here")) {
        contentStartIdx = i + 1;
        break;
      }
    }

    return lines.slice(contentStartIdx).join("\n").trim();
  }

  function onContext(params: HookParams, config: InterjectConfig, context: HookContext): HookReturn {
    if (!config.enable) {
      return params;
    }

    const card = findCard(CARD_TITLE);
    if (!card) {
      return params;
    }

    const content = getContent(card);
    if (!content) {
      return params;
    }

    const remainingTurns = (context.state.remainingTurns as number) || 0;

    if (remainingTurns === 0) {
      context.state.remainingTurns = config.maxTurns;
    }

    let { text } = params;
    text +=
      "<SYSTEM MESSAGE> Please keep in mind: " + content + "</SYSTEM MESSAGE>";

    context.state.remainingTurns = (context.state.remainingTurns as number) - 1;

    if (context.state.remainingTurns === 0) {
      card.entry = getDefaultInterjectEntry();
    }

    context.updateConfig("RemainingTurns", context.state.remainingTurns);

    return { ...params, text };
  }

  return {
    name: "interject",
    configSection: `--- Interject ---
Enable: true  # Enable/disable interject feature
MaxTurns: 3  # Number of turns to show the interjected message
RemainingTurns: 0  # Countdown (managed automatically)`,
    validateConfig,
    hooks: {
      onContext,
    },
    initialState: {
      remainingTurns: 0,
    },
  };
})();
