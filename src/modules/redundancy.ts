import type { Module, HookParams, HookReturn, HookContext } from "../types";
import { getLastActionOfType } from "../utils/history";
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
        "similarityThreshold",
        { min: 0, max: 100, integer: true },
        70
      ),
    };
  }

  function onOutput(
    params: HookParams,
    config: RedundancyConfig,
    context: HookContext
  ): HookReturn {
    if (!config.enable) {
      return params;
    }

    const lastAIMessage = getLastActionOfType("continue");
    if (!lastAIMessage) {
      return params;
    }

    const lastText = lastAIMessage.text || lastAIMessage.rawText || "";
    const result = checkAndMerge(
      lastText,
      params.text,
      config.similarityThreshold
    );

    if (result.shouldMerge && result.mergedContent) {
      return { ...params, text: result.mergedContent };
    }

    return params;
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
