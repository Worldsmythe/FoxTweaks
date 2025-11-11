import type { Module, StoryCard, AIPromptRequest } from "./types";
import { parseConfig, parseConfigLine, rebuildConfigLine } from "./config";
import { findCard, createStoryCard } from "./utils/cards";
import { getDefaultInterjectEntry } from "./modules/interject";
import { DEBUG } from "./debug" with { type: "macro" };

declare function log(message: string): void;

const CARD_TITLE = "FoxTweaks Config";
const CARD_KEYS = "Configure FoxTweaks behavior";

interface GlobalAIState {
  activePrompt: AIPromptRequest | null;
  promptQueue: AIPromptRequest[];
  promptIdCounter: number;
  responses: Record<string, string>;
}

interface ModuleState {
  __foxTweaksAI?: GlobalAIState;
  [key: string]: Record<string, unknown> | GlobalAIState | undefined;
}

/**
 * FoxTweaks core library for managing modules and hooks
 */
export class FoxTweaks {
  private modules: Module<unknown>[] = [];
  private cachedConfig: Record<string, unknown> | null = null;

  private getGlobalState(): ModuleState {
    const globalState = (globalThis as any).state;
    if (!globalState) {
      throw new Error("Global state object not available");
    }
    if (!globalState.foxTweaks) {
      globalState.foxTweaks = {};
    }
    return globalState.foxTweaks;
  }

  private getAIState(): GlobalAIState {
    const globalState = this.getGlobalState();
    if (!globalState.__foxTweaksAI) {
      globalState.__foxTweaksAI = {
        activePrompt: null,
        promptQueue: [],
        promptIdCounter: 0,
        responses: {},
      };
    }
    return globalState.__foxTweaksAI as GlobalAIState;
  }

  /**
   * Registers a module with FoxTweaks
   * @param module - The module to register
   */
  registerModule<T>(module: Module<T>): void {
    this.modules.push(module as Module<unknown>);
  }

  /**
   * Gets the module state for a specific module
   * @param moduleName - Name of the module
   * @returns The module's state object
   */
  getModuleState(moduleName: string): Record<string, unknown> {
    if (moduleName === "__foxTweaksAI") {
      return {};
    }
    const globalState = this.getGlobalState();
    if (!globalState[moduleName]) {
      const module = this.modules.find((m) => m.name === moduleName);
      globalState[moduleName] = module?.initialState
        ? { ...module.initialState }
        : {};
    }
    return globalState[moduleName] as Record<string, unknown>;
  }

  /**
   * Gets all default config sections from registered modules
   * @returns Map of module names to default config sections
   */
  private getDefaultSections(): Record<string, string> {
    const sections: Record<string, string> = {};
    for (const module of this.modules) {
      sections[module.name] = module.configSection;
    }
    return sections;
  }

  /**
   * Gets names of all registered modules
   * @returns Array of module names
   */
  private getAllModuleNames(): string[] {
    return this.modules.map((m) => m.name);
  }

  /**
   * Ensures the config card exists and is properly configured
   * @returns The config card
   */
  private ensureConfigCard(): StoryCard | null {
    if (DEBUG()) {
      log(`[FoxTweaks] ensureConfigCard - searching for card with title="${CARD_TITLE}" or keys="${CARD_KEYS}"`);
    }

    let card = findCard(CARD_TITLE) || findCard(CARD_KEYS);

    if (!card) {
      if (DEBUG()) {
        log(`[FoxTweaks] ensureConfigCard - no card found, creating new one`);
      }
      createStoryCard(CARD_KEYS);
      card = findCard(CARD_KEYS);
      if (card) {
        card.title = CARD_TITLE;
        card.type = "class";

        const defaults = this.getDefaultSections();
        const sections = this.getAllModuleNames();
        card.description = sections
          .map((s) => this.disableConfigSection(defaults[s] || ""))
          .join("\n\n");
        card.entry = getDefaultInterjectEntry();

        if (DEBUG()) {
          log(`[FoxTweaks] ensureConfigCard - created new card with ${sections.length} sections (all disabled)`);
        }
      }
    } else {
      if (DEBUG()) {
        log(`[FoxTweaks] ensureConfigCard - found existing card, repairing config`);
      }
      this.repairConfig(card);

      if (!card.entry || card.entry.trim() === "") {
        card.entry = getDefaultInterjectEntry();
      }
    }

    return card;
  }

  /**
   * Disables a config section by setting Enable to false
   * @param configSection - The config section string
   * @returns The disabled config section
   */
  private disableConfigSection(configSection: string): string {
    return configSection.replace(
      /^(\s*Enable:\s*)\S+(.*)$/m,
      "$1false$2"
    );
  }

  /**
   * Repairs config card by adding missing sections
   * @param card - The config card to repair
   */
  private repairConfig(card: StoryCard): void {
    const defaults = this.getDefaultSections();
    const allSections = this.getAllModuleNames();

    if (DEBUG()) {
      log(`[FoxTweaks] repairConfig called - all sections: ${allSections.join(", ")}`);
    }

    const description = card.description || "";
    const foundSections = new Set<string>();

    for (const sectionName of allSections) {
      const sectionHeader = defaults[sectionName]?.match(/^---\s*(.+?)\s*---/)?.[0];
      if (sectionHeader && description.includes(sectionHeader)) {
        foundSections.add(sectionName);
      }
    }

    if (DEBUG()) {
      log(`[FoxTweaks] repairConfig - found sections: ${Array.from(foundSections).join(", ")}`);
    }

    const missingSections = allSections.filter((s) => !foundSections.has(s));

    if (DEBUG()) {
      log(`[FoxTweaks] repairConfig - missing sections: ${missingSections.join(", ")}`);
    }

    if (missingSections.length > 0) {
      let repairedDescription = (card.description || "").trim();

      for (const section of missingSections) {
        if (DEBUG()) {
          log(`[FoxTweaks] repairConfig - adding section: ${section}`);
        }
        if (repairedDescription) {
          repairedDescription += "\n\n";
        }
        repairedDescription += this.disableConfigSection(defaults[section] || "");
      }

      if (DEBUG()) {
        log(`[FoxTweaks] repairConfig - updated description length: ${repairedDescription.length} (was: ${(card.description || "").length})`);
      }

      card.description = repairedDescription;
    } else {
      if (DEBUG()) {
        log(`[FoxTweaks] repairConfig - no missing sections, nothing to add`);
      }
    }
  }

  /**
   * Loads and parses the configuration from the config card
   * @returns Parsed configuration object
   */
  loadConfig<T extends Record<string, unknown>>(): T {
    if (this.cachedConfig) {
      if (DEBUG()) {
        log(`[FoxTweaks] Using cached config`);
      }
      return this.cachedConfig as T;
    }

    if (DEBUG()) {
      log(`[FoxTweaks] Loading config from card...`);
    }
    const card = this.ensureConfigCard();
    if (!card) {
      if (DEBUG()) {
        log(`[FoxTweaks] No config card found, using defaults`);
      }
      const defaults = this.getDefaultSections();
      const defaultConfig = Object.values(defaults).join("\n\n");
      this.cachedConfig = parseConfig(defaultConfig, this.modules);
      return this.cachedConfig as T;
    }

    if (DEBUG()) {
      log(
        `[FoxTweaks] Parsing config from card description (${(card.description || "").length} chars)`
      );
    }
    this.cachedConfig = parseConfig(card.description || "", this.modules);

    if ((this.cachedConfig as any).narrativeChecklist) {
      const nc = (this.cachedConfig as any).narrativeChecklist;
      if (DEBUG()) {
        log(
          `[FoxTweaks] Parsed narrativeChecklist config: remainingTurns=${nc.remainingTurns}, minTurnsBeforeCheck=${nc.minTurnsBeforeCheck}`
        );
      }
    }

    return this.cachedConfig as T;
  }

  /**
   * Updates a specific configuration value in the config card
   * @param sectionName - Name of the module section
   * @param key - Configuration key to update
   * @param value - New value
   */
  updateConfigValue(sectionName: string, key: string, value: unknown): void {
    if (DEBUG()) {
      log(
        `[FoxTweaks] updateConfigValue called: section="${sectionName}", key="${key}", value="${value}"`
      );
    }
    const card = findCard(CARD_TITLE);
    if (!card) {
      if (DEBUG()) {
        log(`[FoxTweaks] ERROR: Config card not found (title="${CARD_TITLE}")`);
      }
      return;
    }

    const lines = (card.description || "").split("\n");
    let inSection = false;
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line.trim().startsWith("---")) {
        const normalizedLine = line.toLowerCase().replace(/\s+/g, "");
        const normalizedSection = sectionName.toLowerCase().replace(/\s+/g, "");
        inSection = normalizedLine.includes(normalizedSection);
        if (inSection) {
          if (DEBUG()) {
            log(
              `[FoxTweaks] Found section: ${line} (normalized match: "${normalizedLine}" includes "${normalizedSection}")`
            );
          }
        }
        continue;
      }

      if (inSection) {
        const parsed = parseConfigLine(line);
        if (parsed.isValid && parsed.key.toLowerCase() === key.toLowerCase()) {
          const newLine = rebuildConfigLine(
            parsed.key,
            String(value),
            parsed.comment,
            parsed.hasComment
          );
          if (DEBUG()) {
            log(`[FoxTweaks] Updating line ${i}: "${line}" -> "${newLine}"`);
          }
          lines[i] = newLine;
          updated = true;
          break;
        }
      }
    }

    if (!updated) {
      if (DEBUG()) {
        log(
          `[FoxTweaks] WARNING: Key "${key}" not found in section "${sectionName}"`
        );
      }
    } else {
      if (DEBUG()) {
        log(`[FoxTweaks] Successfully updated config card`);
      }
    }

    card.description = lines.join("\n");
    this.cachedConfig = null;
  }

  /**
   * Creates hook functions that orchestrate all registered modules
   * @returns Object containing onInput, onContext, onOutput, and reformatContext hooks
   */
  createHooks(): {
    onInput: (text: string) => string;
    onContext: (text: string) => string;
    onOutput: (text: string) => string;
    reformatContext: (text: string) => string;
  } {
    const isAutoCardsActive = (): boolean => {
      const globalState = (globalThis as any).state;
      if (!globalState) return false;

      return !!(
        globalState.AC?.signal?.generate ||
        globalState.AC?.generation?.queue?.length > 0 ||
        globalState.AC?.signal?.compress
      );
    };

    const createAIContext = (moduleName: string) => {
      const aiState = this.getAIState();

      return {
        requestPrompt: (prompt: string, responseMarker: string) => {
          if (!aiState.promptQueue) {
            aiState.promptQueue = [];
          }
          if (!aiState.promptIdCounter) {
            aiState.promptIdCounter = 0;
          }

          const request: AIPromptRequest = {
            id: `ai_prompt_${aiState.promptIdCounter++}`,
            moduleName,
            prompt,
            responseMarker,
          };

          if (isAutoCardsActive()) {
            aiState.promptQueue.push(request);
            return;
          }

          if (aiState.activePrompt) {
            aiState.promptQueue.push(request);
            return;
          }

          aiState.activePrompt = request;
        },
        hasActivePrompt: () => aiState.activePrompt !== null,
        getResponse: (responseMarker: string) => {
          if (!aiState.responses) {
            aiState.responses = {};
          }
          return aiState.responses[responseMarker] || null;
        },
        clearResponse: (responseMarker: string) => {
          if (!aiState.responses) {
            aiState.responses = {};
          }
          delete aiState.responses[responseMarker];
        },
      };
    };

    const onInput = (text: string): string => {
      if (!text) {
        return text;
      }

      const config = this.loadConfig();
      let currentText = text;

      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).storyCards || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onInput) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.getModuleState(module.name),
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
              ai: createAIContext(module.name),
            };
            currentText = module.hooks.onInput(
              currentText,
              moduleConfig,
              context
            );
          }
        }
      }

      return currentText;
    };

    const onContext = (text: string): string => {
      if (!text) {
        return text;
      }

      const config = this.loadConfig();
      let currentText = text;

      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).storyCards || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onContext) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.getModuleState(module.name),
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
              ai: createAIContext(module.name),
            };
            currentText = module.hooks.onContext(
              currentText,
              moduleConfig,
              context
            );
          }
        }
      }

      const aiState = this.getAIState();

      if (!isAutoCardsActive() && aiState.activePrompt) {
        currentText = currentText + aiState.activePrompt.prompt;
      }

      return currentText;
    };

    const onOutput = (text: string): string => {
      if (!text) {
        return text;
      }

      let currentText = text;
      const aiState = this.getAIState();

      if (aiState.activePrompt) {
        const { responseMarker } = aiState.activePrompt;
        const markerPattern = new RegExp(
          `${responseMarker}:\\s*([^\\n]+)`,
          "i"
        );
        const match = currentText.match(markerPattern);

        if (match && match[1]) {
          if (!aiState.responses) {
            aiState.responses = {};
          }
          aiState.responses[responseMarker] = match[1].trim();

          currentText = currentText.replace(
            new RegExp(`${responseMarker}:[^\\n]+\\n?`, "gi"),
            ""
          );
        }

        aiState.activePrompt = null;

        if (
          !isAutoCardsActive() &&
          aiState.promptQueue &&
          aiState.promptQueue.length > 0
        ) {
          aiState.activePrompt = aiState.promptQueue.shift() || null;
        }
      }

      const config = this.loadConfig();
      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).storyCards || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onOutput) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.getModuleState(module.name),
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
              ai: createAIContext(module.name),
            };
            currentText = module.hooks.onOutput(
              currentText,
              moduleConfig,
              context
            );
          }
        }
      }

      return currentText;
    };

    const reformatContext = (text: string): string => {
      if (!text) {
        return text;
      }

      const config = this.loadConfig();
      let currentText = text;

      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).storyCards || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onReformatContext) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.getModuleState(module.name),
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
              ai: createAIContext(module.name),
            };
            currentText = module.hooks.onReformatContext(
              currentText,
              moduleConfig,
              context
            );
          }
        }
      }

      return currentText;
    };

    return { onInput, onContext, onOutput, reformatContext };
  }
}
