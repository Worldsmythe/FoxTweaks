import type { Module, HookContext } from "../types";
import { booleanValidator, numberValidator } from "../utils/validation";
import {
  getSectionContent,
  injectStoryCard,
  removeSectionHeader,
} from "../utils/contextPipeline";

export interface TreeCardsConfig {
  enable: boolean;
  linkPercentage: number;
  implicitLinks: boolean;
  maxDepth: number;
  minSentences: number;
}

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

export function extractWikilinks(text: string): string[] {
  const links: string[] = [];
  let match;

  const pattern = new RegExp(WIKILINK_PATTERN.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    const link = match[1];
    if (link) {
      links.push(link.trim());
    }
  }

  return links;
}

export function findCardByReference(
  reference: string,
  cards: StoryCard[]
): StoryCard | undefined {
  const lowerRef = reference.toLowerCase();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;

    if (card.title?.toLowerCase() === lowerRef) {
      return card;
    }
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || !card.keys) continue;

    for (let j = 0; j < card.keys.length; j++) {
      const key = card.keys[j];
      if (key && key.toLowerCase().includes(lowerRef)) {
        return card;
      }
    }
  }

  return undefined;
}

export function extractImplicitLinks(
  entry: string,
  cards: StoryCard[]
): StoryCard[] {
  const linkedCards: StoryCard[] = [];
  const lowerEntry = entry.toLowerCase();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || !card.keys) continue;

    for (let j = 0; j < card.keys.length; j++) {
      const key = card.keys[j];
      if (key && lowerEntry.includes(key.toLowerCase())) {
        linkedCards.push(card);
        break;
      }
    }
  }

  return linkedCards;
}

export function findTriggeredCards(
  worldLoreContent: string,
  cards: StoryCard[]
): StoryCard[] {
  const triggered: StoryCard[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card?.entry && worldLoreContent.includes(card.entry)) {
      triggered.push(card);
    }
  }

  return triggered;
}

interface BFSNode {
  card: StoryCard;
  depth: number;
}

export function collectLinkedCards(
  triggerCards: StoryCard[],
  allCards: StoryCard[],
  config: TreeCardsConfig
): StoryCard[] {
  const visited = new Set<string>();
  const result: StoryCard[] = [];
  const queue: BFSNode[] = [];

  for (let i = 0; i < triggerCards.length; i++) {
    const card = triggerCards[i];
    if (card?.id) {
      visited.add(card.id);
    }
  }

  for (let i = 0; i < triggerCards.length; i++) {
    const card = triggerCards[i];
    if (card) {
      queue.push({ card, depth: 0 });
    }
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || node.depth >= config.maxDepth) continue;

    const { card, depth } = node;
    if (!card.entry) continue;

    const explicitLinks = extractWikilinks(card.entry);
    const linkedCards: StoryCard[] = [];

    for (let i = 0; i < explicitLinks.length; i++) {
      const linkTarget = explicitLinks[i];
      if (!linkTarget) continue;

      const linkedCard = findCardByReference(linkTarget, allCards);
      if (linkedCard && !visited.has(linkedCard.id)) {
        linkedCards.push(linkedCard);
      }
    }

    if (config.implicitLinks) {
      const implicitCards = extractImplicitLinks(card.entry, allCards);
      for (let i = 0; i < implicitCards.length; i++) {
        const implicitCard = implicitCards[i];
        if (implicitCard && !visited.has(implicitCard.id)) {
          const alreadyAdded = linkedCards.some(c => c.id === implicitCard.id);
          if (!alreadyAdded) {
            linkedCards.push(implicitCard);
          }
        }
      }
    }

    for (let i = 0; i < linkedCards.length; i++) {
      const linkedCard = linkedCards[i];
      if (!linkedCard) continue;

      visited.add(linkedCard.id);
      result.push(linkedCard);
      queue.push({ card: linkedCard, depth: depth + 1 });
    }
  }

  return result;
}

export const TreeCards: Module<TreeCardsConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): TreeCardsConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      linkPercentage: numberValidator(
        raw,
        "linkpercentage",
        { min: 0, max: 100, integer: true },
        20
      ),
      implicitLinks: booleanValidator(raw, "implicitlinks", false),
      maxDepth: numberValidator(
        raw,
        "maxdepth",
        { min: 1, max: 10, integer: true },
        3
      ),
      minSentences: numberValidator(
        raw,
        "minsentences",
        { min: 1, integer: true },
        10
      ),
    };
  }

  function onContext(
    text: string,
    config: TreeCardsConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    const maxChars = context.info.maxChars;
    if (!maxChars) {
      return text;
    }

    const worldLoreSection = getSectionContent(text, "World Lore");
    if (!worldLoreSection) {
      return text;
    }

    const worldLoreBody = removeSectionHeader(worldLoreSection);
    const triggeredCards = findTriggeredCards(worldLoreBody, context.storyCards);

    if (triggeredCards.length === 0) {
      return text;
    }

    const linkedCards = collectLinkedCards(
      triggeredCards,
      context.storyCards,
      config
    );

    if (linkedCards.length === 0) {
      return text;
    }

    let currentText = text;
    let budgetRemaining = Math.floor((maxChars * config.linkPercentage) / 100);

    for (let i = 0; i < linkedCards.length; i++) {
      const card = linkedCards[i];
      if (!card?.entry) continue;

      const cardLength = card.entry.length + 2;
      if (cardLength > budgetRemaining) {
        break;
      }

      const result = injectStoryCard(currentText, card, {
        maxChars,
        minSentences: config.minSentences,
        budgetPercentage: 100,
      });

      if (!result.injected) {
        break;
      }

      currentText = result.text;
      budgetRemaining -= result.charsUsed;
    }

    return currentText;
  }

  return {
    name: "treeCards",
    configSection: `--- Tree Cards ---
Enable: false  # Enable hierarchical story card linking
LinkPercentage: 20  # Max % of context for linked cards
ImplicitLinks: false  # Also match card keys as substrings
MaxDepth: 3  # Maximum link depth to traverse
MinSentences: 10  # Minimum sentences to preserve in Recent Story`,
    validateConfig,
    hooks: {
      onContext,
    },
  };
})();
