import type { Module, HookContext, VirtualContext } from "../types";
import { booleanValidator } from "../utils/validation";
import { escapeRegex } from "../utils/string";
import {
  getSection,
  setSection,
  addWorldLoreCard,
} from "../utils/virtualContext";

export interface WordBoundaryTriggersConfig {
  enable: boolean;
}

const CONFIG_CARD_TITLE = "FoxTweaks Config";

function isConfigCard(card: StoryCard): boolean {
  return card.title === CONFIG_CARD_TITLE || card.type === "class";
}

function buildSearchText(ctx: VirtualContext): string {
  const parts: string[] = [];

  if (ctx.preamble) {
    parts.push(ctx.preamble);
  }

  const recentStory = getSection(ctx, "Recent Story");
  if (recentStory?.body) {
    parts.push(recentStory.body);
  }

  if (ctx.postamble) {
    parts.push(ctx.postamble);
  }

  return parts.join("\n");
}

export function matchesWordBoundary(text: string, key: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`, "i");
  return pattern.test(text);
}

export const WordBoundaryTriggers: Module<WordBoundaryTriggersConfig> = (() => {
  function validateConfig(
    raw: Record<string, unknown>
  ): WordBoundaryTriggersConfig {
    return {
      enable: booleanValidator(raw, "enable", false),
    };
  }

  function onContext(
    ctx: VirtualContext,
    config: WordBoundaryTriggersConfig,
    context: HookContext
  ): VirtualContext {
    if (!config.enable) {
      return ctx;
    }

    const originalWorldLore = getSection(ctx, "World Lore");
    const availableSpace = originalWorldLore?.body.length ?? 0;

    let currentCtx = setSection(ctx, "World Lore", "");
    currentCtx = {
      preamble: currentCtx.preamble,
      sections: currentCtx.sections,
      postamble: currentCtx.postamble,
      worldLoreCards: [],
      raw: currentCtx.raw,
      maxChars: currentCtx.maxChars,
    };

    const searchText = buildSearchText(ctx);

    const matchedCards: StoryCard[] = [];

    for (let i = 0; i < context.storyCards.length; i++) {
      const card = context.storyCards[i];
      if (!card || !card.keys || !card.entry) continue;
      if (isConfigCard(card)) continue;

      for (let j = 0; j < card.keys.length; j++) {
        const key = card.keys[j];
        if (!key) continue;

        if (matchesWordBoundary(searchText, key)) {
          matchedCards.push(card);
          break;
        }
      }
    }

    let usedSpace = 0;

    for (let i = 0; i < matchedCards.length; i++) {
      const card = matchedCards[i];
      if (!card?.entry) continue;

      const entryLength = card.entry.length + 2;
      if (usedSpace + entryLength > availableSpace) continue;

      currentCtx = addWorldLoreCard(currentCtx, card);
      usedSpace += entryLength;
    }

    return currentCtx;
  }

  return {
    name: "wordBoundaryTriggers",
    configSection: `--- Word Boundary Triggers ---
Enable: false  # Replace native triggers with word-boundary matching`,
    validateConfig,
    hooks: {
      onContext,
    },
  };
})();
