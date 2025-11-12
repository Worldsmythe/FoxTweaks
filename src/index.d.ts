declare global {
  interface HookReturn {
    /** The text to return or modify. Special handling for empty string. */
    text?: string;
    /** If true, stops the game loop or triggers special error handling. */
    stop?: boolean;
  }

  interface History {
    /** The text of the action */
    text: string;
    /** The raw text of the action (optional, sometimes provided by AI Dungeon) */
    rawText?: string;
    /** The type of the action, the most common types are listed below:
     * - `start`: the first action of an adventure
     * - `continue`: an action created by the AI
     * - `do`: a do action submitted by a player
     * - `say`: a say action submitted by a player
     * - `story`: a story action submitted by a player
     * - `see`: a see action submitted by a player
     */
    type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
  }

  interface StoryCard {
    /** A unique numerical id for the story card */
    id: string;
    /** Keys that should cause the story card to be included in the model context */
    keys?: string[];
    /** A text field that can be used to separate story cards into categories */
    type?: string;
    /** The text that should be included in the model context if the story card is included */
    entry?: string;
    /** The title of the story card */
    title?: string;
    /** The description of the story card */
    description?: string;
    /** The date the story card was updated */
    updatedAt?: string;
  }

  interface ThirdPerson {
    text: string;
    visibleTo?: Array<
      | string
      | {
          name: string;
        }
    >;
  }

  type PlotEssentials = string;

  interface StateMemory {
    /** Is added to the beginning of the context, before the history. Corresponds to the Memory available in the UI */
    context?: PlotEssentials;
    /** Is added close to the end of the context, immediately before the most recent AI response. Corresponds to the Authors Note available in the UI. */
    authorsNote?: string;
    /** Is added to the very end of the context, after the most recent player input. */
    frontMemory?: string;
  }

  interface AutoCards {
    signal: {
      generate: boolean;
      compress: boolean;
    };
    generation: {
      queue: string[];
    };
  }

  interface State {
    /** The current memory for the adventure.
     * NOTE: Note that setting the context or authorsNote here will take precedence
     * over the memory or authors note from the UI, but will not update them. If the
     * context  or authorsNote is not set or is set to an empty string, then the
     * settings from the UI will still be used, so it is not possible to use the
     * state to clear the memory or authors note completely.
     * Any updates made to the memory in the onOutput hook will not have any affect
     * until the next player action.
     */
    memory: StateMemory;
    /** A string which will be shown to the user. (Not yet implemented on Phoenix). */
    message: string | ThirdPerson | ThirdPerson[];
    /** Additional state fields, retained between runs of the same story. */
    AC?: AutoCards;
    [key: string]: unknown;
  }

  interface Info {
    actionCount: number;
    characters: Array<
      | string
      | {
          name: string;
        }
    >;
    maxChars?: number;
    memoryLength?: number;
    contextTokens?: number;
  }

  var storyCards: StoryCard[];
  var history: History[];
  var info: Info;
  var state: State;

  /**
   * Deep freezes an object (like Object.freeze, but recursively).
   *
   * @param obj - The object to freeze.
   *
   * @returns The frozen object.
   */
  function deepFreeze<T>(obj: T): T;

  /**
   * Logs a message to the console.
   *
   * @param message - The message to log.
   */
  function log(message: string): void;

  /**
   * Adds a story card and returns the index of the new card.
   *
   * @param keys - The keys of the story card.
   * @param entry - The entry of the story card.
   * @param type - The type of the story card.
   * @param name - The name of the story card.
   * @param description - The description of the story card.
   *
   * @returns The index of the new card.
   */
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    description?: string
  ): number;

  /**
   * Adds a story card and returns the index of the new card.
   *
   * @param keys - The keys of the story card.
   * @param entry - The entry of the story card.
   * @param type - The type of the story card.
   * @param name - The name of the story card.
   * @param description - The description of the story card.
   * @param options - The options for the story card.
   *
   * @returns The index of the new card.
   */
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    description?: string,
    options?: { returnCard: false }
  ): number;

  /**
   * Adds a story card and returns the story card.
   *
   * @param keys - The keys of the story card.
   * @param entry - The entry of the story card.
   * @param type - The type of the story card.
   * @param name - The name of the story card.
   * @param description - The description of the story card.
   * @param options - The options for the story card.
   *
   * @returns The story card.
   */
  function addStoryCard(
    keys: string,
    entry?: string,
    type?: string,
    name?: string,
    description?: string,
    options?: { returnCard: true }
  ): StoryCard;

  /**
   * Removes a story card.
   *
   * @param index - The index of the story card to remove.
   */
  function removeStoryCard(index: number): void;

  /**
   * Updates a story card.
   *
   * @param index - The index of the story card to update.
   * @param keys - The keys of the story card.
   * @param entry - The entry of the story card.
   * @param type - The type of the story card.
   */
  function updateStoryCard(
    index: number,
    keys: string,
    entry: string,
    type: string
  ): void;
}

export {};
