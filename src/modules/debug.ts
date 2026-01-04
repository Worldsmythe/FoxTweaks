import type { Module, HookContext, VirtualContext } from "../types";
import { booleanValidator } from "../utils/validation";
import { findStoryCard, findStoryCardIndex } from "../utils/storyCardHelpers";
import { serializeContext } from "../utils/virtualContext";

export interface DebugConfig {
  enableDebugCards: boolean;
}

const DEBUG_TEMP_CARD_KEYS = "foxtweaks_debug_temp";

function storeTempDebugData(hookType: string, text: string): void {
  const existing = findStoryCard((c) => c.type === `debug_temp_${hookType}`);

  if (existing) {
    const index = findStoryCardIndex((c) => c.type === `debug_temp_${hookType}`);
    if (index !== -1) {
      updateStoryCard(index, DEBUG_TEMP_CARD_KEYS, text);
    }
  } else {
    const card = addStoryCard(
      DEBUG_TEMP_CARD_KEYS,
      text,
      `debug_temp_${hookType}`,
      undefined,
      undefined,
      { returnCard: true }
    );
    if (card) {
      card.type = `debug_temp_${hookType}`;
    }
  }
}

export const DebugStart: Module<DebugConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): DebugConfig {
    return {
      enableDebugCards: booleanValidator(raw, "enabledebugcards"),
    };
  }

  function onInput(
    text: string,
    config: DebugConfig,
    context: HookContext
  ): string {
    if (config.enableDebugCards) {
      storeTempDebugData("input", text);
    }
    return text;
  }

  function onContext(
    ctx: VirtualContext,
    config: DebugConfig,
    context: HookContext
  ): VirtualContext {
    if (config.enableDebugCards) {
      storeTempDebugData("context", serializeContext(ctx));
    }
    return ctx;
  }

  function onOutput(
    text: string,
    config: DebugConfig,
    context: HookContext
  ): string {
    if (config.enableDebugCards) {
      storeTempDebugData("output", text);
    }
    return text;
  }

  return {
    name: "debug",
    configSection: `--- Debug ---
EnableDebugCards: false  # Enable/disable debug story cards showing hook text transformations`,
    validateConfig,
    hooks: {
      onInput,
      onContext,
      onOutput,
    },
  };
})();

export const DebugEnd: Module<DebugConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): DebugConfig {
    return {
      enableDebugCards: booleanValidator(raw, "enabledebugcards"),
    };
  }

  function createOrUpdateDebugCard(
    hookType: string,
    originalText: string,
    finalText: string
  ): void {
    const cardTitle = `${hookType.charAt(0).toUpperCase() + hookType.slice(1)} Debug`;

    const cardContent = `Original ${hookType} text:
\`\`\`
${originalText || "(empty)"}
\`\`\`

Resulting ${hookType} text:
\`\`\`
${finalText || "(empty)"}
\`\`\`

Changed: ${originalText !== finalText ? "Yes" : "No"}`;

    const existing = findStoryCard((c) => c.type === `debug_${hookType}`);

    if (existing) {
      const index = findStoryCardIndex((c) => c.type === `debug_${hookType}`);
      if (index !== -1) {
        updateStoryCard(index, "foxtweaks_debug", cardContent);
        const card = storyCards[index];
        if (card) {
          card.title = cardTitle;
          card.type = `debug_${hookType}`;
        }
      }
    } else {
      const card = addStoryCard(
        "foxtweaks_debug",
        cardContent,
        `debug_${hookType}`,
        cardTitle,
        "FoxTweaks debug information",
        { returnCard: true }
      );
      if (card) {
        card.title = cardTitle;
      }
    }
  }

  function processDebugHook(
    text: string,
    config: DebugConfig,
    hookType: string
  ): string {
    if (!config.enableDebugCards) {
      return text;
    }

    const tempCard = findStoryCard((c) => c.type === `debug_temp_${hookType}`);
    if (tempCard && tempCard.entry) {
      const originalText = tempCard.entry;
      createOrUpdateDebugCard(hookType, originalText, text);

      const tempIndex = findStoryCardIndex(
        (c) => c.type === `debug_temp_${hookType}`
      );
      if (tempIndex !== -1) {
        removeStoryCard(tempIndex);
      }
    }

    return text;
  }

  function onInput(
    text: string,
    config: DebugConfig,
    context: HookContext
  ): string {
    return processDebugHook(text, config, "input");
  }

  function onContext(
    ctx: VirtualContext,
    config: DebugConfig,
    context: HookContext
  ): VirtualContext {
    processDebugHook(serializeContext(ctx), config, "context");
    return ctx;
  }

  function onOutput(
    text: string,
    config: DebugConfig,
    context: HookContext
  ): string {
    return processDebugHook(text, config, "output");
  }

  return {
    name: "debug",
    configSection: ``,
    validateConfig,
    hooks: {
      onInput,
      onContext,
      onOutput,
    },
  };
})();
