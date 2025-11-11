import type { Module, StoryCard } from "./types";
import { parseConfig, parseConfigLine, rebuildConfigLine } from "./config";
import { findCard, createStoryCard } from "./utils/cards";
import { getDefaultInterjectEntry } from "./modules/interject";

const CARD_TITLE = "FoxTweaks Config";
const CARD_KEYS = "Configure FoxTweaks behavior";

interface ModuleState {
  [key: string]: Record<string, unknown>;
}

/**
 * FoxTweaks core library for managing modules and hooks
 */
export class FoxTweaks {
  private modules: Module<unknown>[] = [];
  private moduleStates: ModuleState = {};
  private cachedConfig: Record<string, unknown> | null = null;

  /**
   * Registers a module with FoxTweaks
   * @param module - The module to register
   */
  registerModule<T>(module: Module<T>): void {
    this.modules.push(module as Module<unknown>);

    if (module.initialState) {
      this.moduleStates[module.name] = { ...module.initialState };
    } else {
      this.moduleStates[module.name] = {};
    }
  }

  /**
   * Gets the module state for a specific module
   * @param moduleName - Name of the module
   * @returns The module's state object
   */
  getModuleState(moduleName: string): Record<string, unknown> {
    if (!this.moduleStates[moduleName]) {
      this.moduleStates[moduleName] = {};
    }
    return this.moduleStates[moduleName];
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
    let card = findCard(CARD_TITLE) || findCard(CARD_KEYS);

    if (!card) {
      createStoryCard(CARD_KEYS);
      card = findCard(CARD_KEYS);
      if (card) {
        card.title = CARD_TITLE;
        card.type = "class";

        const defaults = this.getDefaultSections();
        const sections = this.getAllModuleNames();
        card.description = sections.map((s) => defaults[s]).join("\n\n");
        card.entry = getDefaultInterjectEntry();
      }
    } else {
      this.repairConfig(card);

      if (!card.entry || card.entry.trim() === "") {
        card.entry = getDefaultInterjectEntry();
      }
    }

    return card;
  }

  /**
   * Repairs config card by adding missing sections
   * @param card - The config card to repair
   */
  private repairConfig(card: StoryCard): void {
    const config = parseConfig(card.description || "", this.modules);
    const defaults = this.getDefaultSections();
    const allSections = this.getAllModuleNames();

    const foundSections = new Set(Object.keys(config));
    const missingSections = allSections.filter((s) => !foundSections.has(s));

    if (missingSections.length > 0) {
      let repairedDescription = (card.description || "").trim();

      for (const section of missingSections) {
        if (repairedDescription) {
          repairedDescription += "\n\n";
        }
        repairedDescription += defaults[section];
      }

      card.description = repairedDescription;
    }
  }

  /**
   * Loads and parses the configuration from the config card
   * @returns Parsed configuration object
   */
  loadConfig<T extends Record<string, unknown>>(): T {
    if (this.cachedConfig) {
      return this.cachedConfig as T;
    }

    const card = this.ensureConfigCard();
    if (!card) {
      const defaults = this.getDefaultSections();
      const defaultConfig = Object.values(defaults).join("\n\n");
      this.cachedConfig = parseConfig(defaultConfig, this.modules);
      return this.cachedConfig as T;
    }

    this.cachedConfig = parseConfig(card.description || "", this.modules);
    return this.cachedConfig as T;
  }

  /**
   * Updates a specific configuration value in the config card
   * @param sectionName - Name of the module section
   * @param key - Configuration key to update
   * @param value - New value
   */
  updateConfigValue(sectionName: string, key: string, value: unknown): void {
    const card = findCard(CARD_TITLE);
    if (!card) return;

    const lines = (card.description || "").split("\n");
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line.trim().startsWith("---")) {
        inSection = line.toLowerCase().includes(sectionName.toLowerCase());
        continue;
      }

      if (inSection) {
        const parsed = parseConfigLine(line);
        if (parsed.isValid && parsed.key.toLowerCase() === key.toLowerCase()) {
          lines[i] = rebuildConfigLine(
            parsed.key,
            String(value),
            parsed.comment,
            parsed.hasComment
          );
          break;
        }
      }
    }

    card.description = lines.join("\n");
    this.cachedConfig = null;
  }

  /**
   * Creates hook functions that orchestrate all registered modules
   * @returns Object containing onInput, onContext, and onOutput hooks
   */
  createHooks(): {
    onInput: (text: string) => string;
    onContext: (text: string) => string;
    onOutput: (text: string) => string;
  } {
    const onInput = (text: string): string => {
      if (!text) {
        return text;
      }

      const config = this.loadConfig();
      let currentText = text;

      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).worldInfo || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onInput) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.moduleStates[module.name] || {},
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
            };
            currentText = module.hooks.onInput(currentText, moduleConfig, context);
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
      const globalStoryCards = (globalThis as any).worldInfo || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onContext) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.moduleStates[module.name] || {},
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
            };
            currentText = module.hooks.onContext(currentText, moduleConfig, context);
          }
        }
      }

      return currentText;
    };

    const onOutput = (text: string): string => {
      if (!text) {
        return text;
      }

      const config = this.loadConfig();
      let currentText = text;

      const globalHistory = (globalThis as any).history || [];
      const globalStoryCards = (globalThis as any).worldInfo || [];
      const globalInfo = (globalThis as any).info || {};

      for (const module of this.modules) {
        if (module.hooks.onOutput) {
          const moduleConfig = config[module.name];
          if (moduleConfig !== undefined) {
            const context = {
              state: this.moduleStates[module.name] || {},
              updateConfig: (key: string, value: unknown) => {
                this.updateConfigValue(module.name, key, value);
              },
              history: globalHistory,
              storyCards: globalStoryCards,
              info: globalInfo,
            };
            currentText = module.hooks.onOutput(currentText, moduleConfig, context);
          }
        }
      }

      return currentText;
    };

    return { onInput, onContext, onOutput };
  }
}
