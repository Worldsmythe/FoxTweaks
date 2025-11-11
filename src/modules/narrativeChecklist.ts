import type { Module, HookContext, StoryCard } from "../types";
import { booleanValidator, numberValidator } from "../utils/validation";
import { findCard, createStoryCard } from "../utils/cards";
import {
  injectSection,
  truncateSection,
  getSectionContent,
} from "../utils/contextPipeline";
import { DEBUG } from "../debug" with { type: "macro" };

declare function log(message: string): void;

const CHECKLIST_CARD_TITLE = "Narrative Checklist";
const CHECKLIST_CARD_KEYS = "narrative checklist";

export interface NarrativeChecklistConfig {
  enable: boolean;
  minTurnsBeforeCheck: number;
  remainingTurns: number;
  alwaysIncludeInContext: boolean;
  minContextChars: number;
}

interface ChecklistState {
  checklistCardId: string | null;
}

export const NarrativeChecklist: Module<NarrativeChecklistConfig> = (() => {
  function validateConfig(
    raw: Record<string, unknown>
  ): NarrativeChecklistConfig {
    return {
      enable: booleanValidator(raw, "enable", true),
      minTurnsBeforeCheck: numberValidator(
        raw,
        "minturnsbeforecheck",
        { min: 1 },
        50
      ),
      remainingTurns: numberValidator(raw, "remainingturns", { min: 0 }, 50),
      alwaysIncludeInContext: booleanValidator(
        raw,
        "alwaysincludeincontext",
        true
      ),
      minContextChars: numberValidator(
        raw,
        "mincontextchars",
        { min: 100 },
        2000
      ),
    };
  }

  function ensureChecklistCard(): StoryCard | null {
    let card = findCard(CHECKLIST_CARD_TITLE);

    if (!card) {
      createStoryCard(CHECKLIST_CARD_KEYS);
      card = findCard(CHECKLIST_CARD_KEYS);

      if (card) {
        card.title = CHECKLIST_CARD_TITLE;
        card.type = "class";
        card.entry = `- [ ] Example checklist item
- [ ] Another item to track`;
      }
    }

    return card;
  }

  function parseChecklistItems(
    entry: string
  ): Array<{ checked: boolean; text: string }> {
    const items: Array<{ checked: boolean; text: string }> = [];
    const lines = entry.split("\n");

    for (const line of lines) {
      const checkedMatch = line.match(/^- \[x\] (.+)$/i);
      const uncheckedMatch = line.match(/^- \[ \] (.+)$/);

      if (checkedMatch && checkedMatch[1]) {
        items.push({ checked: true, text: checkedMatch[1] });
      } else if (uncheckedMatch && uncheckedMatch[1]) {
        items.push({ checked: false, text: uncheckedMatch[1] });
      }
    }

    return items;
  }

  function formatChecklistItems(
    items: Array<{ checked: boolean; text: string }>
  ): string {
    return items
      .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
      .join("\n");
  }

  function onInput(
    text: string,
    config: NarrativeChecklistConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    if (context.state.checklistCardId === undefined) {
      context.state.checklistCardId = null;
    }

    const card = ensureChecklistCard();
    if (card && context.state.checklistCardId !== card.id) {
      context.state.checklistCardId = card.id;
    }

    return text;
  }

  function onOutput(
    text: string,
    config: NarrativeChecklistConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    if (DEBUG()) {
      log(`[NarrativeChecklist] onOutput - config.remainingTurns=${config.remainingTurns}, config.minTurnsBeforeCheck=${config.minTurnsBeforeCheck}`);
    }
    const card = ensureChecklistCard();

    const response = context.ai.getResponse("CHECKLIST_UPDATE");
    if (response && card) {
      if (DEBUG()) {
        log(`[NarrativeChecklist] Processing AI response for checklist update`);
      }
      const completedIndices = parseCompletionResponse(response);
      const allItems = parseChecklistItems(card.entry || "");
      const unchecked = allItems.filter((item) => !item.checked);
      updateChecklistWithCompletions(
        card,
        allItems,
        unchecked,
        completedIndices
      );
      context.ai.clearResponse("CHECKLIST_UPDATE");
    }

    const newRemainingTurns = config.remainingTurns - 1;
    if (DEBUG()) {
      log(`[NarrativeChecklist] Decrementing turns: ${config.remainingTurns} -> ${newRemainingTurns}`);
    }

    if (newRemainingTurns <= 0 && card && !context.ai.hasActivePrompt()) {
      if (DEBUG()) {
        log(`[NarrativeChecklist] Time to check checklist (turns expired)`);
      }
      const items = parseChecklistItems(card.entry || "");
      const uncheckedItems = items.filter((item) => !item.checked);

      if (uncheckedItems.length > 0) {
        if (DEBUG()) {
          log(`[NarrativeChecklist] Found ${uncheckedItems.length} unchecked items, requesting AI check`);
        }
        const checklistText = uncheckedItems
          .map((item, idx) => `${idx + 1}. ${item.text}`)
          .join("\n");

        const prompt = `\n\n<<SYSTEM: Review the narrative checklist below against recent events. If any items are clearly completed, respond ONLY with "CHECKLIST_UPDATE: [numbers]" (e.g., "CHECKLIST_UPDATE: 1, 3"). If none are completed, respond with "CHECKLIST_UPDATE: none". Then continue the story.

Narrative Checklist:
${checklistText}>>`;

        context.ai.requestPrompt(prompt, "CHECKLIST_UPDATE");
      } else {
        if (DEBUG()) {
          log(`[NarrativeChecklist] No unchecked items to check`);
        }
      }

      if (DEBUG()) {
        log(`[NarrativeChecklist] Resetting turns to ${config.minTurnsBeforeCheck}`);
      }
      context.updateConfig("remainingTurns", config.minTurnsBeforeCheck);
    } else {
      if (DEBUG()) {
        log(`[NarrativeChecklist] Updating turns to ${newRemainingTurns}`);
      }
      context.updateConfig("remainingTurns", newRemainingTurns);
    }

    return text;
  }

  function parseCompletionResponse(response: string): number[] {
    const normalized = response.toLowerCase().trim();

    if (normalized === "none" || normalized === "") {
      return [];
    }

    const numbers = normalized.match(/\d+/g);
    if (!numbers) {
      return [];
    }

    return numbers.map((n) => parseInt(n, 10));
  }

  function updateChecklistWithCompletions(
    card: StoryCard,
    allItems: Array<{ checked: boolean; text: string }>,
    uncheckedItems: Array<{ checked: boolean; text: string }>,
    completedIndices: number[]
  ): void {
    for (const index of completedIndices) {
      if (index >= 1 && index <= uncheckedItems.length) {
        const itemToComplete = uncheckedItems[index - 1];
        if (itemToComplete) {
          const itemIndex = allItems.findIndex(
            (item) => item.text === itemToComplete.text
          );
          if (itemIndex !== -1 && allItems[itemIndex]) {
            allItems[itemIndex].checked = true;
          }
        }
      }
    }

    card.entry = formatChecklistItems(allItems);
  }

  function onReformatContext(
    text: string,
    config: NarrativeChecklistConfig,
    context: HookContext
  ): string {
    if (!config.enable || !config.alwaysIncludeInContext) {
      return text;
    }

    const recentStorySection = getSectionContent(text, "Recent Story");
    if (!recentStorySection) {
      return text;
    }

    const card = ensureChecklistCard();
    if (!card || !card.entry) {
      return text;
    }

    const checklistContent = `Narrative Checklist:\n${card.entry}`;

    text = injectSection(text, "Narrative Checklist", checklistContent, {
      beforeSection: "Recent Story",
    });

    const maxChars = context.info.maxChars;
    if (maxChars && text.length > maxChars) {
      const overage = text.length - maxChars;
      const targetRecentStoryLength = Math.max(
        config.minContextChars,
        recentStorySection.length - overage
      );
      text = truncateSection(text, "Recent Story", targetRecentStoryLength);
    }

    return text;
  }

  return {
    name: "narrativeChecklist",
    configSection: `--- Narrative Checklist ---
Enable: true  # Enable narrative checklist tracking
MinTurnsBeforeCheck: 50  # Minimum turns between AI completion checks
RemainingTurns: 50  # Turns remaining until next check
AlwaysIncludeInContext: true  # Always include checklist in context
MinContextChars: 2000  # Minimum characters to preserve for recent story (keep high for Auto-Cards compatibility)`,
    validateConfig,
    hooks: {
      onInput,
      onOutput,
      onReformatContext,
    },
    initialState: {
      checklistCardId: null,
    },
  };
})();
