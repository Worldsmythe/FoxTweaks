import type { Module, HookContext } from "../types";
import { booleanValidator, numberValidator } from "../utils/validation";
import { findCard, createStoryCard } from "../utils/storyCardHelpers";
import {
  injectSection,
  truncateSection,
  getSectionContent,
} from "../utils/contextPipeline";
import { DEBUG } from "../debug" with { type: "macro" };

declare function log(message: string): void;

const CHECKLIST_CARD_TITLE = "Narrative Checklist";
const CHECKLIST_CARD_KEYS = "narrative checklist";
const MIN_ACTION_PROGRESS = 3;

export interface NarrativeChecklistConfig {
  enable: boolean;
  maxTurnsBeforeCheck: number;
  remainingTurns: number;
  alwaysIncludeInContext: boolean;
  minContextChars: number;
}

interface ChecklistState {
  checklistCardId: string | null;
  minBoundaryReached: boolean;
  minBoundaryActionText: string | null;
  boundaryActionCount: number | null;
  shouldTriggerCheck: boolean;
}

export const NarrativeChecklist: Module<NarrativeChecklistConfig> = (() => {
  function getTypedState(state: Record<string, unknown>): ChecklistState {
    return state as unknown as ChecklistState;
  }

  function validateConfig(
    raw: Record<string, unknown>
  ): NarrativeChecklistConfig {
    let maxTurns = numberValidator(raw, "maxturnsbeforecheck", { min: 1 }, 0);
    if (maxTurns === 0) {
      maxTurns = numberValidator(raw, "minturnsbeforecheck", { min: 1 }, 50);
    }

    return {
      enable: booleanValidator(raw, "enable", true),
      maxTurnsBeforeCheck: maxTurns,
      remainingTurns: numberValidator(raw, "remainingturns", { min: 0 }, maxTurns),
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
      card =
        addStoryCard(
          CHECKLIST_CARD_KEYS,
          undefined,
          undefined,
          undefined,
          undefined,
          { returnCard: true }
        ) ?? undefined;

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

    const typedState = getTypedState(context.state);
    if (typedState.checklistCardId === undefined) {
      typedState.checklistCardId = null;
    }
    if (typedState.minBoundaryReached === undefined) {
      typedState.minBoundaryReached = false;
    }
    if (typedState.minBoundaryActionText === undefined) {
      typedState.minBoundaryActionText = null;
    }
    if (typedState.boundaryActionCount === undefined) {
      typedState.boundaryActionCount = null;
    }
    if (typedState.shouldTriggerCheck === undefined) {
      typedState.shouldTriggerCheck = false;
    }

    const card = ensureChecklistCard();
    if (card && typedState.checklistCardId !== card.id) {
      typedState.checklistCardId = card.id;
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

    const typedState = getTypedState(context.state);

    if (DEBUG()) {
      log(
        `[NarrativeChecklist] onOutput - remainingTurns=${config.remainingTurns}, minBoundaryReached=${typedState.minBoundaryReached}, shouldTriggerCheck=${typedState.shouldTriggerCheck}`
      );
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

    if (typedState.shouldTriggerCheck && card && !context.ai.hasActivePrompt()) {
      if (DEBUG()) {
        log(`[NarrativeChecklist] Boundary exited context, triggering check`);
      }
      const items = parseChecklistItems(card.entry || "");
      const uncheckedItems = items.filter((item) => !item.checked);

      if (uncheckedItems.length > 0) {
        if (DEBUG()) {
          log(
            `[NarrativeChecklist] Found ${uncheckedItems.length} unchecked items, requesting AI check`
          );
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

      typedState.shouldTriggerCheck = false;
      typedState.minBoundaryReached = false;
      typedState.minBoundaryActionText = null;
      typedState.boundaryActionCount = null;
      context.updateConfig("remainingTurns", config.maxTurnsBeforeCheck);
      if (DEBUG()) {
        log(`[NarrativeChecklist] Reset state and turns to ${config.maxTurnsBeforeCheck}`);
      }
    } else if (!typedState.minBoundaryReached) {
      const newRemainingTurns = config.remainingTurns - 1;
      if (DEBUG()) {
        log(
          `[NarrativeChecklist] Decrementing turns: ${config.remainingTurns} -> ${newRemainingTurns}`
        );
      }

      if (newRemainingTurns <= 0) {
        if (DEBUG()) {
          log(`[NarrativeChecklist] Minimum turns reached, setting boundary`);
        }
        typedState.minBoundaryReached = true;
        typedState.boundaryActionCount = context.info.actionCount;

        const recentHistory = context.history[context.history.length - 1];
        if (recentHistory && recentHistory.text) {
          const boundaryText = recentHistory.text.slice(0, 200);
          typedState.minBoundaryActionText = boundaryText;
          if (DEBUG()) {
            log(`[NarrativeChecklist] Stored boundary at action ${context.info.actionCount}: "${boundaryText.slice(0, 50)}..."`);
          }
        }
        context.updateConfig("remainingTurns", 0);
      } else {
        context.updateConfig("remainingTurns", newRemainingTurns);
      }
    } else {
      const actionsSinceBoundary = typedState.boundaryActionCount !== null
        ? context.info.actionCount - typedState.boundaryActionCount
        : 0;
      const hasMaxTurnsElapsed = config.remainingTurns <= -config.maxTurnsBeforeCheck;
      const hasMinActionsProgressed = actionsSinceBoundary >= MIN_ACTION_PROGRESS;

      if (DEBUG()) {
        log(`[NarrativeChecklist] Waiting for boundary to exit context (actions since: ${actionsSinceBoundary}, min required: ${MIN_ACTION_PROGRESS}, max turns reached: ${hasMaxTurnsElapsed})`);
      }

      if (hasMaxTurnsElapsed && card && !context.ai.hasActivePrompt()) {
        if (DEBUG()) {
          log(`[NarrativeChecklist] Maximum turns reached, triggering check regardless of boundary`);
        }
        typedState.shouldTriggerCheck = true;
      }

      context.updateConfig("remainingTurns", config.remainingTurns - 1);
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
    if (!config.enable) {
      return text;
    }

    const typedState = getTypedState(context.state);

    if (typedState.minBoundaryReached && typedState.minBoundaryActionText) {
      const boundaryInContext = text.includes(typedState.minBoundaryActionText);
      const actionsSinceBoundary = typedState.boundaryActionCount !== null
        ? context.info.actionCount - typedState.boundaryActionCount
        : 0;
      const hasMinActionsProgressed = actionsSinceBoundary >= MIN_ACTION_PROGRESS;

      if (DEBUG()) {
        log(
          `[NarrativeChecklist] Checking boundary in context: ${boundaryInContext ? "present" : "EXITED"}, actions since: ${actionsSinceBoundary}, min required: ${MIN_ACTION_PROGRESS}`
        );
      }
      if (!boundaryInContext && hasMinActionsProgressed) {
        if (DEBUG()) {
          log(`[NarrativeChecklist] Boundary has exited context and sufficient actions passed, will trigger check`);
        }
        typedState.shouldTriggerCheck = true;
      }
    }

    if (!config.alwaysIncludeInContext) {
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

  function migrateConfigSection(sectionText: string): string {
    return sectionText.replace(
      /MinTurnsBeforeCheck:/g,
      "MaxTurnsBeforeCheck:"
    );
  }

  return {
    name: "narrativeChecklist",
    configSection: `--- Narrative Checklist ---
Enable: true  # Enable narrative checklist tracking
MaxTurnsBeforeCheck: 50  # Maximum turns before checking (checks earlier when boundary exits context)
RemainingTurns: 50  # Turns remaining until check
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
      minBoundaryReached: false,
      minBoundaryActionText: null,
      boundaryActionCount: null,
      shouldTriggerCheck: false,
    },
    migrateConfigSection,
  };
})();
