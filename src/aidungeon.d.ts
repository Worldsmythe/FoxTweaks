/**
 * AI Dungeon Scripting API type definitions.
 *
 * @author Worldsmythe
 *
 * @remarks
 * This file defines the global types available in AI Dungeon scripts.
 * Scripts run in three lifecycle hooks:
 *
 * - `onInput`: Modify player's input before constructing model context
 * - `onModelContext`: Change the text sent to the AI model before generation
 * - `onOutput`: Modify the model's output before showing it to the player
 *
 * The modifier scripts are expected to look like this:
 *
 * ```javascript
 * const modifier = (text) => {
 *
 *   let modifiedText = text
 *
 *   // The text passed in is either the user's input or players output to modify.
 *   if(text.includes('grab a sword')) {
 *
 *     // You can modify the state variable to keep track of state throughout the adventure
 *     state.items = ['sword']
 *
 *     // Setting state.memory.context will cause that to be used instead of the user set memory
 *     state.memory = {context: 'You have a sword.'}
 *
 *     // Setting state.message will set an info message that will be displayed in the game
 *     state.message = 'You got a sword!'
 *
 *     // You can log things to the side console when testing with console.log
 *     console.log('Added a sword to player')
 *
 *     modifiedText = text + '\nYou also now have a sword!'
 *   }
 *
 *   // You must return an object with the text property defined.
 *   return {text: modifiedText}
 * }
 *
 * // Don't modify this part
 * modifier(text)
 * ```
 *
 * Each script run is independent - memory is not shared between runs.
 * Use the `state` object to persist data between turns.
 *
 * Context structure:
 * ```
 * [AI instructions]
 * [Plot essentials]
 * World Lore:
 * [Story cards injected here]
 *
 * Story Summary:
 * [Summary content]
 *
 * Memories:
 * [Story's memories or the value of state.memory.context, if set]
 *
 * Recent Story:
 * [History actions]
 * [Author's note or the value of state.memory.authorsNote, if set]
 * [Last AI response or player action]
 * [The value of state.memory.frontMemory]
 * ```
 *
 * Story cards are injected into the context when their keys match content in
 * the recent story separated by a newline.
 *
 * Story card format:
 * ```
 * World Lore:
 * [Story card content]
 *
 * [Additional card content]
 * ```
 */
declare global {
  /**
   * Return value from scripting hooks.
   *
   * @remarks
   * For `onInput`:
   * - Returning empty string throws error shown to player
   * - Returned text replaces player's input
   *
   * For `onModelContext`:
   * - Returning empty string causes context to build as if script didn't run
   * - Returned text replaces the entire context sent to AI
   *
   * For `onOutput`:
   * - Returning empty string throws error shown to player
   * - Returned text replaces AI's output
   *
   * When `stop` is true, the game loop halts (generally triggers errors).
   */
  interface HookReturn {
    /** The text to return or modify. Special handling for empty string. */
    text?: string;
    /** If true, stops the game loop or triggers special error handling. */
    stop?: boolean;
  }

  /**
   * Represents a single action in the adventure history.
   *
   * @remarks
   * History contains recent actions from the adventure. Each action has text
   * and a type that indicates its source (player action vs AI response).
   */
  interface History {
    /** The text of the action */
    text: string;
    /** The raw text of the action (optional, sometimes provided by AI Dungeon) */
    rawText?: string;
    /**
     * The type of the action. Most common types:
     * - `start`: the first action of an adventure
     * - `continue`: an action created by the AI
     * - `do`: a do action submitted by a player
     * - `say`: a say action submitted by a player
     * - `story`: a story action submitted by a player
     * - `see`: a see action submitted by a player
     */
    type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
  }

  /**
   * Represents a story card that can be dynamically included in the AI context.
   *
   * @remarks
   * Story cards are included in the model context when their keys match content
   * in the recent story. The `entry` field is what gets injected into the context.
   * Story cards appear in the "World Lore" section of the context.
   */
  interface StoryCard {
    /** A unique identifier for the story card */
    id: string;
    /** Keys that trigger this card's inclusion in the model context when matched */
    keys?: string[];
    /** Category for organizing story cards (e.g., "character", "location", "item") */
    type?: string;
    /** The content injected into context when this card is triggered */
    entry?: string;
    /** Display name of the story card */
    title?: string;
    /** Additional notes or metadata (not sent to AI) */
    description?: string;
    /** ISO timestamp when the card was created */
    createdAt?: string;
    /** ISO timestamp of last modification */
    updatedAt?: string;
    /** ISO timestamp when the card was deleted (soft delete) */
    deletedAt?: string;
    /** Whether this card should be used for character creation */
    useForCharacterCreation?: boolean;
  }

  /**
   * Message format for multiplayer adventures with visibility control.
   *
   * @remarks
   * Used with state.message to control which players see specific messages.
   * Only relevant in multiplayer scenarios.
   */
  interface ThirdPerson {
    /** The message text to display */
    text: string;
    /**
     * Optional list of character names who should see this message.
     * If not specified, message is visible to all players.
     */
    visibleTo?: Array<
      | string
      | {
          name: string;
        }
    >;
  }

  /**
   * Alias for string representing plot-essential information.
   * Used in state.memory.context to store core story details.
   */
  type PlotEssentials = string;
  /** Alias for string representing AI instructions. */
  type AIInstructions = string;
  /** Alias for string representing story summary. */
  type StorySummary = string;
  /** Alias for string representing author's note. */
  type AuthorsNote = string;

  /**
   * Memory configuration that controls where text appears in the AI context.
   *
   * @remarks
   * Setting these values in state.memory takes precedence over UI settings,
   * but does not update the UI. Setting to empty string will fall back to UI values.
   */
  interface StateMemory {
    /**
     * Added to the beginning of the context, before history.
     * Corresponds to the Memory field in the UI.
     */
    context?: PlotEssentials;
    /**
     * Added near the end of context, immediately before the most recent AI response.
     * Corresponds to the Author's Note field in the UI.
     */
    authorsNote?: AuthorsNote;
    /**
     * Added to the very end of context, after the most recent player input.
     * Useful for last-minute instructions to the AI.
     */
    frontMemory?: string;
  }

  /**
   * Persistent state object available across script runs.
   *
   * @remarks
   * Scripts can store arbitrary data in state to persist between turns.
   * State is specific to each adventure and persists across script executions.
   * Changes to state.memory in onOutput won't affect the AI until the next turn.
   *
   * Set values directly without helper functions: `state.myKey = myValue`
   */
  interface State {
    /**
     * Memory configuration for the adventure.
     *
     * @remarks
     * Setting context or authorsNote here takes precedence over UI settings
     * but doesn't update them. Empty string falls back to UI values.
     * Changes in onOutput hook don't affect AI until next player action.
     */
    memory: StateMemory;
    /**
     * Message to show the user (not yet implemented on Phoenix).
     * Can be a string or ThirdPerson object(s) for multiplayer visibility control.
     */
    message: string | ThirdPerson | ThirdPerson[];
    /** Scripts can add arbitrary persistent fields */
    [key: string]: unknown;
  }

  /**
   * Contextual information about the current adventure and AI generation.
   */
  interface Info {
    /** Total number of actions in the adventure history */
    actionCount: number;
    /** Character names for players in multiplayer adventures */
    characterNames: Array<
      | string
      | {
          name: string;
        }
    >;
    /**
     * Estimated maximum characters for model context (onModelContext only).
     * Character-per-token ratio varies, so this is an approximation.
     */
    maxChars?: number;
    /**
     * Number of characters in the memory section (onModelContext only).
     * Useful for calculating available space for dynamic content.
     */
    memoryLength?: number;
  }

  /**
   * Array of story cards from the adventure.
   *
   * @remarks
   * Story cards are dynamically included in the AI context when their keys
   * match content in recent story. Cards can be added, removed, or modified
   * using the `addStoryCard`, `removeStoryCard`, and `updateStoryCard` functions.
   *
   * **Note**: Direct array manipulation is supported: `storyCards.push()`, `storyCards[i] = ...`
   */
  var storyCards: StoryCard[];

  /**
   * Array of recent actions from the adventure.
   *
   * @remarks
   * Contains both player inputs and AI responses, ordered chronologically.
   * Use the `type` field to distinguish between different action types.
   */
  var history: History[];

  /**
   * Information about the current adventure and AI generation context.
   *
   * @remarks
   * Contains metadata like action count and character names. Some fields like
   * `maxChars` and `memoryLength` are only available in the `onModelContext` hook.
   */
  var info: Info;

  /**
   * Persistent state storage available across script runs.
   *
   * @remarks
   * Use this to store data that should persist between turns. Each adventure
   * has its own isolated state. Modify directly: `state.myKey = myValue`
   */
  var state: State;

  /**
   * Memory object (also available at state.memory).
   *
   * @remarks
   * Direct reference to the memory configuration. Changes here affect state.memory.
   *
   * @deprecated Use state.memory instead; this is not documented.
   */
  // var memory: StateMemory;

  /**
   * Stop flag for controlling game loop.
   *
   * @remarks
   * When true, can halt certain operations. Set in HookReturn.stop instead.
   */
  // var stop: boolean;

  /**
   * The current text being processed (input or output depending on hook).
   *
   * @remarks
   * Available as the parameter to modifier functions.
   *
   * @deprecated Use the modifier parameter instead; this is not documented.
   */
  // var text: string;

  /**
   * Logs a message to the script editor console.
   *
   * @remarks
   * Useful for debugging scripts. Output appears in the script editor console
   * for the scenario author for adventures they own.
   *
   * @param message - The message to log.
   */
  function log(message: string): void;

  /**
   * Adds a new story card to the adventure.
   *
   * Creates a card with a random ID and pushes it to the storyCards array.
   * The card will be triggered when its keys match content in the recent story.
   * The `entry` field is what gets injected into the "World Lore" section of context.
   *
   * @param keys - Comma-separated keywords that trigger this card's inclusion
   * @param entry - The text to inject into the AI context when triggered (default: undefined)
   * @param type - Category for organizing cards (default: "Custom")
   * @param name - Display name for the card (default: keys)
   * @param notes - Additional notes stored in description field (default: "")
   * @param options - Options object with returnCard: false
   *
   * @returns The index of the newly added card in the storyCards array or the card object if returnCard is true
   *
   * @remarks
   * **Reference Implementation:**
   * ```javascript
   * (keys, entry, type = 'Custom', name = keys, notes = '', options) => {
   *   const { returnCard = false } = options ?? {}
   *   storyCards.push({
   *     id: Math.floor(Math.random() * 1000000000).toString(),
   *     keys,
   *     entry,
   *     type,
   *     title: name,
   *     description: notes
   *   })
   *   if (returnCard) return storyCards[storyCards.length - 1]
   *   else return storyCards.length
   * }
   * ```
   */
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    notes?: string
  ): number;
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    notes?: string,
    options?: { returnCard: false }
  ): number;
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    notes?: string,
    options?: { returnCard: true }
  ): StoryCard;
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    notes?: string,
    options?: { returnCard: boolean }
  ): number | StoryCard;

  /**
   * Removes a story card from the adventure.
   *
   * Uses splice to remove the card at the specified index.
   * Throws an error if the card doesn't exist at the specified index.
   * Use with caution as indices may shift when cards are added/removed.
   *
   * @param index - The index of the story card to remove from the storyCards array
   * @throws Error if no card exists at the given index
   *
   * @remarks
   * **Reference Implementation:**
   * ```javascript
   * (index) => {
   *   if (storyCards[index]) storyCards.splice(index, 1)
   *   else throw new Error(`Story card not found at index ${index} in removeStoryCard`)
   * }
   * ```
   *
   */
  function removeStoryCard(index: number): void;

  /**
   * Updates an existing story card.
   *
   * Replaces the card at the specified index while preserving the id.
   * Optional parameters (type, name, notes) preserve existing values if not provided.
   * Throws an error if the card doesn't exist at the specified index.
   *
   * @param index - The index of the story card to update
   * @param keys - New comma-separated keywords for triggering the card
   * @param entry - New text to inject into context when triggered
   * @param type - New category for organizing the card (optional, preserves existing)
   * @param name - New display name for the card (optional, preserves existing)
   * @param notes - New description/notes (optional, preserves existing)
   * @throws Error if no card exists at the given index
   *
   * @remarks
   * **Reference Implementation:**
   * ```javascript
   * (index, keys, entry, type, name, notes) => {
   *   const existing = storyCards[index]
   *   if (existing) {
   *     storyCards[index] = {
   *       id: existing.id,
   *       keys,
   *       entry,
   *       type: type ?? existing.type,
   *       title: name ?? existing.title,
   *       description: notes ?? existing.description
   *     }
   *   } else {
   *     throw new Error(`Story card not found at index ${index} in updateStoryCard`)
   *   }
   * }
   * ```
   */
  function updateStoryCard(
    index: number,
    keys: string,
    entry: string,
    type?: string,
    name?: string,
    notes?: string
  ): void;
}

export {};
