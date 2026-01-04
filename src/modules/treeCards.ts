import type { Module, HookContext, VirtualContext } from "../types";
import { booleanValidator, numberValidator } from "../utils/validation";
import {
  getSection,
  setSection,
  hasWorldLoreCard,
  truncateSection,
  getContextLength,
  appendToSection,
} from "../utils/virtualContext";

export interface TreeCardsConfig {
  enable: boolean;
  linkPercentage: number;
  implicitLinks: boolean;
  maxDepth: number;
  minSentences: number;
}

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

export function stripWikilinks(text: string): string {
  return text.replace(WIKILINK_PATTERN, "$1");
}

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

interface CardNode {
  card: StoryCard;
  linksTo: Set<string>;
}

interface DiscoveryResult {
  discovered: StoryCard[];
  graph: Map<string, CardNode>;
}

function discoverLinkedCardsWithGraph(
  triggerCards: StoryCard[],
  allCards: StoryCard[],
  config: TreeCardsConfig
): DiscoveryResult {
  const visited = new Set<string>();
  const discovered: StoryCard[] = [];
  const queue: BFSNode[] = [];
  const graph = new Map<string, CardNode>();

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
    const linksTo = new Set<string>();

    for (let i = 0; i < explicitLinks.length; i++) {
      const linkTarget = explicitLinks[i];
      if (!linkTarget) continue;

      const linkedCard = findCardByReference(linkTarget, allCards);
      if (linkedCard) {
        linksTo.add(linkedCard.id);
        if (!visited.has(linkedCard.id)) {
          linkedCards.push(linkedCard);
        }
      }
    }

    if (config.implicitLinks) {
      const implicitCards = extractImplicitLinks(card.entry, allCards);
      for (let i = 0; i < implicitCards.length; i++) {
        const implicitCard = implicitCards[i];
        if (implicitCard) {
          linksTo.add(implicitCard.id);
          if (!visited.has(implicitCard.id)) {
            const alreadyAdded = linkedCards.some(c => c.id === implicitCard.id);
            if (!alreadyAdded) {
              linkedCards.push(implicitCard);
            }
          }
        }
      }
    }

    if (!graph.has(card.id)) {
      graph.set(card.id, { card, linksTo });
    }

    for (let i = 0; i < linkedCards.length; i++) {
      const linkedCard = linkedCards[i];
      if (!linkedCard) continue;

      visited.add(linkedCard.id);
      discovered.push(linkedCard);
      queue.push({ card: linkedCard, depth: depth + 1 });
    }
  }

  return { discovered, graph };
}

function topologicalSort(
  cards: StoryCard[],
  graph: Map<string, CardNode>
): StoryCard[] {
  if (cards.length === 0) return [];

  const cardIds = new Set(cards.map(c => c.id));
  const outDegree = new Map<string, number>();

  for (const card of cards) {
    outDegree.set(card.id, 0);
  }

  for (const [id, node] of graph) {
    if (!cardIds.has(id)) continue;
    for (const targetId of node.linksTo) {
      if (cardIds.has(targetId)) {
        outDegree.set(id, (outDegree.get(id) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of outDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: StoryCard[] = [];
  const processed = new Set<string>();
  const cardMap = new Map(cards.map(c => [c.id, c]));

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || processed.has(id)) continue;

    const card = cardMap.get(id);
    if (!card) continue;

    processed.add(id);
    result.push(card);

    for (const [otherId, otherNode] of graph) {
      if (!cardIds.has(otherId) || processed.has(otherId)) continue;
      if (otherNode.linksTo.has(id)) {
        const newDegree = (outDegree.get(otherId) ?? 1) - 1;
        outDegree.set(otherId, newDegree);
        if (newDegree === 0) queue.push(otherId);
      }
    }
  }

  for (const card of cards) {
    if (!processed.has(card.id)) {
      result.push(card);
    }
  }

  return result;
}

export function collectLinkedCards(
  triggerCards: StoryCard[],
  allCards: StoryCard[],
  config: TreeCardsConfig
): StoryCard[] {
  const { discovered, graph } = discoverLinkedCardsWithGraph(
    triggerCards,
    allCards,
    config
  );

  if (discovered.length === 0) return [];

  return topologicalSort(discovered, graph);
}

function addWorldLoreCardWithEntry(
  ctx: VirtualContext,
  card: StoryCard,
  entry: string
): VirtualContext {
  if (!entry.trim()) return ctx;
  if (hasWorldLoreCard(ctx, card.id)) return ctx;

  const newCards = [...ctx.worldLoreCards, card];
  const ctxWithCard: VirtualContext = {
    preamble: ctx.preamble,
    sections: ctx.sections,
    postamble: ctx.postamble,
    worldLoreCards: newCards,
    raw: ctx.raw,
    maxChars: ctx.maxChars,
  };

  return appendToSection(ctxWithCard, "World Lore", entry);
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
    ctx: VirtualContext,
    config: TreeCardsConfig,
    context: HookContext
  ): VirtualContext {
    if (!config.enable) {
      return ctx;
    }

    const maxChars = ctx.maxChars;
    if (!maxChars) {
      return ctx;
    }

    const worldLoreSection = getSection(ctx, "World Lore");
    if (!worldLoreSection) {
      return ctx;
    }

    let currentCtx = ctx;

    const triggeredCards = ctx.worldLoreCards;

    const currentWorldLore = getSection(currentCtx, "World Lore");
    if (currentWorldLore) {
      const strippedWorldLore = stripWikilinks(currentWorldLore.body);
      if (strippedWorldLore !== currentWorldLore.body) {
        currentCtx = setSection(currentCtx, "World Lore", strippedWorldLore);
      }
    }

    if (triggeredCards.length === 0) {
      return currentCtx;
    }

    const linkedCards = collectLinkedCards(
      [...triggeredCards],
      context.storyCards,
      config
    );

    if (linkedCards.length === 0) {
      return currentCtx;
    }

    let budgetRemaining = Math.floor((maxChars * config.linkPercentage) / 100);

    for (let i = 0; i < linkedCards.length; i++) {
      const card = linkedCards[i];
      if (!card?.entry) continue;

      if (hasWorldLoreCard(currentCtx, card.id)) {
        continue;
      }

      const entry = stripWikilinks(card.entry);
      const cardLength = entry.length + 2;
      if (cardLength > budgetRemaining) {
        break;
      }

      const currentLength = getContextLength(currentCtx);
      const spaceNeeded = currentLength + cardLength - maxChars;

      if (spaceNeeded > 0) {
        const recentStory = getSection(currentCtx, "Recent Story");
        if (!recentStory) {
          break;
        }

        const targetChars = recentStory.body.length - spaceNeeded;
        currentCtx = truncateSection(currentCtx, "Recent Story", {
          targetChars,
          minSentences: config.minSentences,
          fromStart: true,
        });

        const newLength = getContextLength(currentCtx);
        if (newLength + cardLength > maxChars) {
          break;
        }
      }

      currentCtx = addWorldLoreCardWithEntry(currentCtx, card, entry);
      budgetRemaining -= cardLength;
    }

    return currentCtx;
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
