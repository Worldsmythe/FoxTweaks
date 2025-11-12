import type { Module, HookContext } from "../types";
import { isActionType } from "../utils/history";
import { checkAndMerge } from "../utils/similarity";
import { booleanValidator, numberValidator } from "../utils/validation";

export interface RedundancyConfig {
  enable: boolean;
  similarityThreshold: number;
}

export const Redundancy: Module<RedundancyConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): RedundancyConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      similarityThreshold: numberValidator(
        raw,
        "similaritythreshold",
        { min: 0, max: 100, integer: true },
        70
      ),
    };
  }

  function onOutput(
    text: string,
    config: RedundancyConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    let lastAIMessage;
    for (let i = context.history.length - 1; i >= 0; i--) {
      const action = context.history[i];
      if (action && isActionType(action, ["continue"])) {
        lastAIMessage = action;
        break;
      }
    }

    if (!lastAIMessage) {
      return text;
    }

    const lastText = lastAIMessage.text || "";
    const result = checkAndMerge(
      lastText,
      text,
      config.similarityThreshold
    );

    if (result.shouldMerge && result.mergedContent) {
      return result.mergedContent;
    }

    return text;
  }

  return {
    name: "redundancy",
    configSection: `--- Redundancy ---
Enable: true  # Enable/disable redundancy detection and merging
# Similarity threshold (0-100) for fuzzy sentence matching:
SimilarityThreshold: 70`,
    validateConfig,
    hooks: {
      onOutput,
    },
  };
})();
