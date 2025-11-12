interface GenerateCardRequest {
  /** The category or type of the card; defaults to "class" if omitted */
  type?: string;
  /** The card's title (required) */
  title: string;
  /** Optional trigger keywords associated with the card */
  keysStart?: string;
  /** Existing content to prepend to the AI-generated entry */
  entryStart?: string;
  /** Global prompt guiding AI content generation */
  entryPrompt?: string;
  /** Additional prompt info */
  entryPromptDetails?: string;
  /** Target character length for the AI-generated entry */
  entryLimit?: number;
  /** Freeform notes */
  description?: string;
  /** Existing memory content */
  memoryStart?: string;
  /** Whether the card's memory bank will update on its own */
  memoryUpdates?: boolean;
  /** Preferred memory bank size before summarization/compression */
  memoryLimit?: number;
}

interface AutoCardsAPI {
  /** Postpones internal Auto-Cards events for a specified number of turns
   *
   * @param turns A non-negative integer representing the number of turns to postpone events
   * @returns An object containing cooldown values affected by the postponement
   * @throws If turns is not a non-negative integer
   */
  postponeEvents: (turns: number) => {
    amnesia: number;
    postpone: number;
    step: boolean;
    turn: number;
  };

  /** Sets or clears the emergency halt flag to pause Auto-Cards operations
   *
   * @param shouldHalt A boolean value indicating whether to engage (true) or disengage (false) emergency halt
   * @returns The value that was set
   * @throws If called from within isolateLSIv2 scope or with a non-boolean argument
   */
  emergencyHalt: (shouldHalt: boolean) => boolean;

  /** Enables or disables state.message assignments from Auto-Cards
   *
   * @param shouldSuppress If true, suppresses all Auto-Cards messages; false enables them
   * @returns The current pending messages after setting suppression
   * @throws If shouldSuppress is not a boolean
   */
  suppressMessages: (shouldSuppress: boolean) => unknown[];

  /** Logs debug information to the "Debug Log card console
   *
   * @param args Arguments to log for debugging purposes
   * @returns The story card object reference
   */
  debugLog: (...args: unknown[]) => StoryCard;

  /**
   * Toggles Auto-Cards behavior or sets it directly
   *
   * @function
   * @param toggleType If undefined, toggles the current state. If boolean or null, sets the state accordingly
   * @returns The state that was set or inferred
   * @throws If toggleType is not a boolean, null, or undefined
   */
  toggle: (
    toggleType: boolean | null | undefined
  ) => boolean | null | undefined;

  /**
   * Generates a new card using optional prompt details or a card request object
   *
   * @param request Either a fully specified card request object or a string title
   * @param prompt Optional detailed prompt text when using string mode
   * @param startText Optional entry start text when using string mode
   * @returns True if the generation attempt succeeded, false otherwise
   * @throws Throws if called with invalid arguments or missing a required title property
   */
  generateCard: (
    request: GenerateCardRequest | string,
    prompt?: string,
    startText?: string
  ) => boolean;
  generateCard: (request: string, prompt: string, startText: string) => boolean;
  generateCard: (request: GenerateCardRequest) => boolean;

  /**
   * Regenerates a card by title or object reference, optionally preserving or modifying its input info
   *
   * @param request Either a fully specified card request object or a string title for the card to be regenerated
   * @param useOldInfo If true, preserves old info in the new generation; false omits it
   * @param newInfo Additional info to append to the generation prompt
   * @returns True if regeneration succeeded; false otherwise
   * @throws If the request format is invalid, or if the second or third parameters are the wrong types
   */
  redoCard: (
    request: GenerateCardRequest | string,
    useOldInfo?: boolean,
    newInfo?: string
  ) => boolean;

  /**
   * Flags or unflags a card as an auto-card, controlling its automatic generation behavior
   *
   * @param targetCard The card object or title to mark/unmark as an auto-card
   * @param setOrUnset If true, marks the card as an auto-card; false removes the flag
   * @returns True if the operation succeeded; false if the card was invalid or already matched the target state
   * @throws If the arguments are invalid types
   */
  setCardAsAuto: (
    targetCard: StoryCard | string,
    setOrUnset: boolean = true
  ) => boolean;

  /**
   * Appends a memory to a story card's memory bank
   *
   * @param targetCard A card object reference or title string
   * @param newMemory The memory text to add
   * @returns True if the memory was added; false if it was empty, already present, or the card was not found
   * @throws If the inputs are not a string or valid card object reference
   */
  addCardMemory: (targetCard: StoryCard | string, newMemory: string) => boolean;

  /**
   * Removes all previously generated auto-cards and resets various states
   *
   * @returns The number of cards that were removed
   */
  eraseAllAutoCards: () => number;

  /**
   * Retrieves an array of titles currently used by the adventure's story cards
   *
   * @returns An array of strings representing used titles
   */
  getUsedTitles: () => string[];

  /**
   * Retrieves an array of banned titles
   *
   * @returns An array of banned title strings
   */
  getBannedTitles: () => string[];

  /**
   * Sets the banned titles array, replacing any previously banned titles
   *
   * @param titles A comma-separated string or array of strings representing titles to ban
   * @returns An object containing oldBans and newBans arrays
   * @throws If the input is neither a string nor an array of strings
   */
  setBannedTitles: (titles: string | string[]) => {
    oldBans: string[];
    newBans: string[];
  };

  /**
   * Creates a new story card with the specified parameters
   *
   * @param title Card title string or full card template object containing all fields
   * @param entry The entry text for the card
   * @param type The card type (e.g., "character", "location")
   * @param keys The keys (triggers) for the card
   * @param description The notes or memory bank of the card
   * @param insertionIndex Optional index to insert the card at a specific position within storyCards
   * @returns The created card object reference, or null if creation failed
   */
  buildCard: (
    title: string,
    entry: string,
    type: string,
    keys: string,
    description: string,
    insertionIndex?: number
  ) => StoryCard | null;

  /**
   * Finds and returns story cards satisfying a user-defined condition
   *
   * @example
   * ```javascript
   * const leahCard = AutoCards().API.getCard(card => (card.title === "Leah"));
   * ```
   *
   * @param predicate A function which takes a card and returns true if it matches
   * @param getAll If true, returns all matching cards; otherwise returns the first match
   * @returns  A single card object reference, an array of cards, or null if no match is found
   * @throws If the predicate is not a function or getAll is not a boolean
   */
  getCard: (
    predicate: (card: StoryCard) => boolean,
    getAll: boolean = false
  ) => StoryCard | StoryCard[];

  /*** Removes story cards based on a user-defined condition or by direct reference
   *
   * @example
   * ```javascript
   * AutoCards().API.eraseCard(card => (card.title === "Leah"));
   * ```
   *
   * @param predicate A predicate function or a card object reference
   * @param eraseAll If true, removes all matching cards; otherwise removes the first match
   * @returns  True if a single card was removed, false if none matched, or the number of cards erased
   * @throws If the inputs are not a valid predicate function, card object, or boolean
   */
  eraseCard(
    predicate: StoryCard | ((card: StoryCard) => boolean),
    eraseAll: boolean = false
  ): boolean | number;
}

/**
 * State fields used by the Auto-Cards script for dynamic story card generation.
 * @see {@link https://github.com/LewdLeah/Auto-Cards|Auto-Cards}
 *
 */
interface AutoCardsState {
  /** In-game configurable parameters */
  config: {
    /** Is Auto-Cards enabled? */
    doAC: boolean;
    /** Delete all previously generated story cards? */
    deleteAllAutoCards: unknown;
    /** Pin the configuration interface story card near the top? */
    pinConfigureCard: boolean;
    /** Minimum number of turns in between automatic card generation events? */
    addCardCooldown: number;
    /** Use bulleted list mode for newly generated card entries? */
    bulletedListMode: boolean;
    /** Maximum allowed length for newly generated story card entries? */
    defaultEntryLimit: number;
    /** Do newly generated cards have memory updates enabled by default? */
    defaultCardsDoMemoryUpdates: boolean;
    /** Default character limit before the card's memory bank is summarized? */
    defaultMemoryLimit: number;
    /** Approximately how much shorter should recently compressed memories be? (ratio = 10 * old / new) */
    memoryCompressionRatio: number;
    /** Ignore all-caps during title candidate detection? */
    ignoreAllCapsTitles: boolean;
    /** Should player input actions (Do/Say/Story) be considered for future named entity detection? */
    readFromInputs: boolean;
    /** How many (minimum) actions in the past does Auto-Cards look for named entities? */
    minimumLookBackDistance: number;
    /** Is Live Script Interface v2 enabled? */
    LSIv2: unknown;
    /** Should the debug data card be visible? */
    showDebugData: boolean;
    /** How should the AI be prompted when generating new story card entries? */
    generationPrompt: string;
    /** How should the AI be prompted when summarizing memories for a given story card? */
    compressionPrompt: string;
    /** All cards constructed by AC will inherit this type by default */
    defaultCardType: string;
  };
  /** Scalable database to store dynamic game information */
  database: {
    /** Memories are parsed from context and handled by various operations (basically magic) */
    memories: {
      /** Dynamic store of 'story card -> memory' conceptual relations */
      associations: Record<string, unknown>;
      /** Serialized hashset of the 2000 most recent near-duplicate memories purged from context */
      duplicates: string;
    };
    /** Words are pale shadows of forgotten names. As names have power, words have power */
    titles: {
      /** Titles banned from future card generation attempts and various maintenance procedures */
      banned: string[];
      /** Potential future card titles and their turns of occurrence */
      candidates: unknown[];
      /** Helps avoid rechecking the same action text more than once, generally */
      lastActionParsed: number;
      /** Ensures weird combinations of retry/erase events remain predictable */
      lastTextHash: string;
      /** Newly banned titles which will be added to the config card */
      pendingBans: unknown[];
      /** Currently banned titles which will be removed from the config card */
      pendingUnbans: unknown[];
      /** A transient array of known titles parsed from card titles, entry title headers, and trigger keywords */
      used: unknown[];
    };
  };
  /** Moderates the generation of new story card entries */
  generation: {
    /** Continues prompted so far */
    completed: number;
    /** Number of story progression turns between card generations */
    cooldown: number;
    /** Pending card generations */
    pending: unknown[];
    /** Upper limit on consecutive continues */
    permitted: number;
    /** Properties of the incomplete story card */
    workpiece: Record<string, unknown>;
  };
  /** Prevents incompatibility issues borne of state.message modification */
  message: {
    /** Counter to track all Auto-Cards message events */
    event: number;
    /** Pending Auto-Cards message(s) */
    pending: unknown[];
    /** Last turn's state.message */
    previous: string;
    /** API: Allow Auto-Cards to post messages? */
    suppress: boolean;
  };
  /** Collection of various short-term signals passed forward in time */
  signal: {
    /** API: Suspend nearly all Auto-Cards processes */
    emergencyHalt: boolean;
    /** API: Forcefully toggle Auto-Cards on or off */
    forceToggle: unknown;
    /** info.maxChars is only defined onContext but must be accessed during other hooks too */
    maxChars: number;
    /** Signal an upcoming onOutput text replacement */
    outputReplacement: string;
    /** API: Banned titles were externally overwritten */
    overrideBans: number;
    /** Signal a limited recheck of recent title candidates following a retry or erase */
    recheckRetryOrErase: boolean;
    /** Signal the construction of the opposite control card during the upcoming onOutput hook */
    swapControlCards: boolean;
    /** An error occured within the isolateLSIv2 scope during an earlier hook */
    upstreamError: string;
  };
  /** Moderates the compression of story card memories */
  compression: {
    /** Continues prompted so far */
    completed: number;
    /** A title header reference key for this auto-card */
    titleKey: string;
    /** The full and proper title */
    vanityTitle: string;
    /** Response length estimate used to compute # of outputs remaining */
    responseEstimate: number;
    /** Indices [0, n] of oldMemoryBank memories used to build the current memory construct */
    lastConstructIndex: number;
    /** Bank of card memories awaiting compression */
    oldMemoryBank: unknown[];
    /** Incomplete bank of newly compressed card memories */
    newMemoryBank: unknown[];
  };
  /** Timekeeper used for temporal events */
  chronometer: {
    /** Previous turn's measurement of info.actionCount */
    turn: number;
    /** Whether or not various turn counters should be stepped (falsified by retry actions) */
    step: boolean;
    /** Number of consecutive turn interruptions */
    amnesia: number;
    /** API: Postpone Auto-Cards externalities for n many turns */
    postpone: number;
  };
}
declare global {
  interface State {
    AC?: AutoCardsState;
  }

  const AutoCards: AutoCards;

  interface AutoCards {
    (
      inHook?: "input" | "context" | "output",
      inText?: string,
      inStop?: boolean
    ): AutoCards;

    readonly API: AutoCardsAPI;
  }
}

export {};
