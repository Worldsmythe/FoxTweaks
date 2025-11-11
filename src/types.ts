export type { History, StoryCard as SDKStoryCard } from "ai-dungeon-sdk";

/**
 * Extended StoryCard with custom fields used by FoxTweaks
 */
export interface StoryCard {
  id: string;
  keys?: string[];
  type?: string;
  entry?: string;
  title?: string;
  description?: string;
  updatedAt?: string;
}

/**
 * Context provided to hook functions with utilities and state
 */
export interface HookContext {
  /**
   * Module-specific state that persists across hook calls
   */
  state: Record<string, unknown>;

  /**
   * Updates a configuration value in the config card
   */
  updateConfig: (key: string, value: unknown) => void;

  /**
   * Recent action history
   */
  history: import("ai-dungeon-sdk").History[];

  /**
   * Available story cards
   */
  storyCards: StoryCard[];

  /**
   * Additional metadata about the current action
   */
  info: import("ai-dungeon-sdk").Info;
}

/**
 * Hook function that processes text with typed configuration
 * @template TConfig - The configuration type for this hook
 * @param text - The text to process
 * @param config - Typed configuration for this hook
 * @param context - Context with state, utilities, history, and cards
 * @returns Modified text
 */
export type HookFunction<TConfig> = (
  text: string,
  config: TConfig,
  context: HookContext
) => string;

/**
 * Collection of optional hook functions that a module can implement
 * @template TConfig - The configuration type for these hooks
 */
export interface ModuleHooks<TConfig> {
  onInput?: HookFunction<TConfig>;
  onContext?: HookFunction<TConfig>;
  onOutput?: HookFunction<TConfig>;
}

/**
 * Validator function that validates raw config and returns typed config
 * @template TConfig - The configuration type
 */
export type ConfigValidator<TConfig> = (
  raw: Record<string, unknown>
) => TConfig;

/**
 * A FoxTweaks module with typed configuration and hooks
 * @template TConfig - The configuration type for this module
 */
export interface Module<TConfig> {
  /**
   * Unique identifier for this module
   */
  name: string;

  /**
   * Default configuration section text shown in the config card
   */
  configSection: string;

  /**
   * Validator function for parsing and validating configuration
   */
  validateConfig: ConfigValidator<TConfig>;

  /**
   * Hook functions that this module implements
   */
  hooks: ModuleHooks<TConfig>;

  /**
   * Optional initial state for this module
   * Each module instance gets its own state object
   */
  initialState?: Record<string, unknown>;
}

/**
 * Parsed configuration line with metadata
 */
export interface ParsedConfigLine {
  key: string;
  value: string;
  comment: string;
  hasComment: boolean;
  isValid: boolean;
}
