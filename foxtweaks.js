/**
 * FoxTweaks for AI Dungeon
 * A modular plugin system for enhancing AI Dungeon gameplay
 *
 * Modules:
 * - DiceRoll: Automatic dice rolling for action attempts
 * - Interject: Temporary system messages to guide the AI
 * - Paragraph: Formatting and indentation control
 * - Redundancy: Detection and merging of redundant AI outputs
 * - BetterYou: Pronoun replacement for better narrative flow
 * - NarrativeChecklist: Track story objectives with AI-powered completion
 * - MarkdownHeaders: Format context headers with markdown
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 */
const FoxTweaks = (() => {
  function parseConfigLine(line) {
    let commentIdx = line.indexOf("#"),
      hasComment = commentIdx >= 0,
      effectiveLine = hasComment ? line.substring(0, commentIdx) : line,
      comment = hasComment ? line.substring(commentIdx) : "",
      trimmed = effectiveLine.trim(),
      colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1)
      return { key: "", value: "", comment, hasComment, isValid: !1 };
    let key = trimmed.substring(0, colonIdx).trim(),
      value = trimmed.substring(colonIdx + 1).trim();
    return { key, value, comment, hasComment, isValid: !0 };
  }
  function rebuildConfigLine(key, value, comment, hasComment) {
    let base = `${key}: ${value}`;
    if (hasComment) return base + "  " + comment;
    return base;
  }
  function parseConfig(description, modules) {
    let lines = description.split(`
`),
      context = {
        currentSection: null,
        currentModule: null,
        inReplacements: !1,
        rawConfig: {},
      };
    for (let module of modules) context.rawConfig[module.name] = {};
    let currentNestedKey = null,
      currentNestedObject = null;
    for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed.startsWith("---") && trimmed.endsWith("---")) {
        let sectionName = trimmed.replace(/---/g, "").trim().toLowerCase();
        ((context.currentModule = null),
          (context.inReplacements = !1),
          (currentNestedKey = null),
          (currentNestedObject = null));
        for (let module of modules)
          if (
            sectionName.includes(module.name.toLowerCase()) ||
            (module.name === "redundancy" && sectionName.includes("dedup")) ||
            (module.name === "betterYou" &&
              (sectionName.includes("better") ||
                sectionName.includes("you"))) ||
            (module.name === "markdownHeaders" &&
              (sectionName.includes("markdown") ||
                sectionName.includes("headers"))) ||
            (module.name === "narrativeChecklist" &&
              (sectionName.includes("narrative") ||
                sectionName.includes("checklist")))
          ) {
            ((context.currentSection = module.name),
              (context.currentModule = module));
            break;
          }
        continue;
      }
      let parsed = parseConfigLine(line);
      if (!parsed.isValid && trimmed && !trimmed.startsWith("#")) continue;
      if (!parsed.isValid) continue;
      if (!context.currentSection || !context.currentModule) continue;
      let sectionConfig = context.rawConfig[context.currentSection];
      if (!sectionConfig) continue;
      let isIndented = line.length > 0 && (line[0] === " " || line[0] === "\t"),
        lowerKey = parsed.key.toLowerCase();
      if (!isIndented)
        if (
          ((currentNestedKey = null),
          (currentNestedObject = null),
          parsed.value === "" || parsed.value.trim() === "")
        )
          ((currentNestedKey = lowerKey),
            (currentNestedObject = {}),
            (sectionConfig[lowerKey] = currentNestedObject));
        else sectionConfig[lowerKey] = parsed.value;
      else if (currentNestedObject && currentNestedKey) {
        let nestedKey =
          context.currentSection === "betterYou" ? parsed.key : lowerKey;
        currentNestedObject[nestedKey] = parsed.value;
      }
    }
    let result = {};
    for (let module of modules) {
      let raw = context.rawConfig[module.name] || {};
      try {
        result[module.name] = module.validateConfig(raw);
      } catch (error) {
        (console.error(
          `Failed to parse config for module ${module.name}:`,
          error
        ),
          (result[module.name] = module.validateConfig({})));
      }
    }
    return result;
  }
  function findStoryCard(predicate) {
    if (!storyCards) return;
    for (let i = 0; i < storyCards.length; i++) {
      let card = storyCards[i];
      if (card && predicate(card)) return card;
    }
    return;
  }
  function findStoryCardIndex(predicate) {
    if (!storyCards) return -1;
    for (let i = 0; i < storyCards.length; i++) {
      let card = storyCards[i];
      if (card && predicate(card)) return i;
    }
    return -1;
  }
  function findCard(titleOrKeys) {
    if (!storyCards) return;
    for (let i = 0; i < storyCards.length; i++) {
      let card = storyCards[i];
      if (
        card &&
        (card.title === titleOrKeys || card.keys?.includes(titleOrKeys))
      )
        return card;
    }
    return;
  }
  function pinAndSortCards(pinnedCards) {
    if (!storyCards || storyCards.length < 2) return;
    storyCards.sort((a, b) => {
      let dateA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      return (b.updatedAt ? Date.parse(b.updatedAt) : 0) - dateA;
    });
    let cardsToPin = Array.isArray(pinnedCards) ? pinnedCards : [pinnedCards];
    for (let i = cardsToPin.length - 1; i >= 0; i--) {
      let card = cardsToPin[i];
      if (!card) continue;
      let index = storyCards.indexOf(card);
      if (index > 0) (storyCards.splice(index, 1), storyCards.unshift(card));
    }
  }
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function parseBool(value) {
    let v = value.toLowerCase();
    return ["true", "t", "yes", "y", "on", "1"].includes(v);
  }
  function booleanValidator(raw, key, defaultValue = !1) {
    let value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return parseBool(value);
    return defaultValue;
  }
  function stringValidator(raw, key, defaultValue = "") {
    return typeof raw[key] === "string" ? raw[key] : defaultValue;
  }
  function numberValidator(raw, key, options = {}, defaultValue = 0) {
    let value;
    if (typeof raw[key] === "number") value = raw[key];
    else if (typeof raw[key] === "string")
      value = options.integer ? parseInt(raw[key], 10) : parseFloat(raw[key]);
    else return defaultValue;
    if (Number.isNaN(value)) return defaultValue;
    if (options.integer) value = Math.floor(value);
    if (options.min !== void 0 && value < options.min) return defaultValue;
    if (options.max !== void 0 && value > options.max) return defaultValue;
    return value;
  }
  function enumValidator(raw, key, validValues, defaultValue) {
    let value = raw[key];
    if (typeof value === "string" && validValues.includes(value)) return value;
    return defaultValue;
  }
  function arrayValidator(raw, key, defaultValue = []) {
    let value = raw[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "string")
      if (value.includes(","))
        return value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      else return value.split(/\s+/).filter(Boolean);
    return defaultValue;
  }
  function objectValidator(raw, key, defaultValue = {}) {
    let value = raw[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value))
      return value;
    return defaultValue;
  }
  function getDefaultInterjectEntry() {
    return `Type something here to emphasize it to the AI:

    `;
  }
  const Interject = (() => {
    function validateConfig(raw) {
      return {
        enable: booleanValidator(raw, "enable"),
        maxTurns: numberValidator(raw, "maxturns", { min: 1 }, 3),
        remainingTurns: numberValidator(raw, "remainingturns", { min: 0 }, 0),
      };
    }
    function getContent(card) {
      let lines = (card.entry || "").split(`
`),
        contentStartIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line && line.toLowerCase().includes("type something here")) {
          contentStartIdx = i + 1;
          break;
        }
      }
      return lines
        .slice(contentStartIdx)
        .join(
          `
`
        )
        .trim();
    }
    function onContext(text, config, context) {
      if (!config.enable) return text;
      let card = findCard("FoxTweaks Config");
      if (!card) return text;
      let content = getContent(card);
      if (!content) return text;
      if ((context.state.remainingTurns || 0) === 0)
        context.state.remainingTurns = config.maxTurns;
      if (
        ((text +=
          "<SYSTEM MESSAGE> Please keep in mind: " +
          content +
          "</SYSTEM MESSAGE>"),
        (context.state.remainingTurns = context.state.remainingTurns - 1),
        context.state.remainingTurns === 0)
      )
        card.entry = getDefaultInterjectEntry();
      return (
        context.updateConfig("RemainingTurns", context.state.remainingTurns),
        text
      );
    }
    return {
      name: "interject",
      configSection: `--- Interject ---
Enable: true  # Enable/disable interject feature
MaxTurns: 3  # Number of turns to show the interjected message
RemainingTurns: 0  # Countdown (managed automatically)`,
      validateConfig,
      hooks: { onContext },
      initialState: { remainingTurns: 0 },
    };
  })();
  const CARD_TITLE = "FoxTweaks Config",
    CARD_KEYS = "Configure FoxTweaks behavior";
  class FoxTweaks {
    modules = [];
    cachedConfig = null;
    getGlobalState() {
      let globalState = state;
      if (!globalState) throw Error("Global state object not available");
      if (!globalState.foxTweaks) globalState.foxTweaks = {};
      return globalState.foxTweaks;
    }
    getAIState() {
      let globalState = this.getGlobalState();
      if (!globalState.__foxTweaksAI)
        globalState.__foxTweaksAI = {
          activePrompt: null,
          promptQueue: [],
          promptIdCounter: 0,
          responses: {},
        };
      return globalState.__foxTweaksAI;
    }
    registerModule(module) {
      this.modules.push(module);
    }
    getModuleState(moduleName) {
      if (moduleName === "__foxTweaksAI") return {};
      let globalState = this.getGlobalState();
      if (!globalState[moduleName]) {
        let module = this.modules.find((m) => m.name === moduleName);
        globalState[moduleName] = module?.initialState
          ? { ...module.initialState }
          : {};
      }
      return globalState[moduleName];
    }
    getDefaultSections() {
      let sections = {};
      for (let module of this.modules)
        sections[module.name] = module.configSection;
      return sections;
    }
    getAllModuleNames() {
      return this.modules.map((m) => m.name);
    }
    ensureConfigCard() {
      let card = findCard(CARD_TITLE) || findCard(CARD_KEYS);
      if (!card) {
        if (
          ((card =
            addStoryCard(CARD_KEYS, void 0, void 0, void 0, void 0, {
              returnCard: !0,
            }) ?? void 0),
          card)
        ) {
          ((card.title = CARD_TITLE), (card.type = "class"));
          let defaults = this.getDefaultSections(),
            sections = this.getAllModuleNames();
          ((card.description = sections.map((s) =>
            this.disableConfigSection(defaults[s] || "")
          ).join(`

`)),
            (card.entry = getDefaultInterjectEntry()));
        }
      } else if (
        (this.repairConfig(card),
        this.runConfigMigrations(card),
        !card.entry || card.entry.trim() === "")
      )
        card.entry = getDefaultInterjectEntry();
      return card;
    }
    disableConfigSection(configSection) {
      return configSection.replace(/^(\s*Enable:\s*)\S+(.*)$/m, "$1false$2");
    }
    repairConfig(card) {
      let defaults = this.getDefaultSections(),
        allSections = this.getAllModuleNames(),
        description = card.description || "",
        foundSections = new Set();
      for (let sectionName of allSections) {
        let sectionHeader =
          defaults[sectionName]?.match(/^---\s*(.+?)\s*---/)?.[0];
        if (sectionHeader && description.includes(sectionHeader))
          foundSections.add(sectionName);
      }
      let missingSections = allSections.filter((s) => !foundSections.has(s));
      if (missingSections.length > 0) {
        let repairedDescription = (card.description || "").trim();
        for (let section of missingSections) {
          if (repairedDescription)
            repairedDescription += `

`;
          repairedDescription += this.disableConfigSection(
            defaults[section] || ""
          );
        }
        card.description = repairedDescription;
      }
    }
    runConfigMigrations(card) {
      let defaults = this.getDefaultSections(),
        description = card.description || "",
        hasChanges = !1;
      for (let module of this.modules) {
        if (!module.migrateConfigSection) continue;
        let sectionHeader =
          defaults[module.name]?.match(/^---\s*(.+?)\s*---/)?.[0];
        if (!sectionHeader || !description.includes(sectionHeader)) continue;
        let sectionStart = description.indexOf(sectionHeader),
          nextSectionMatch = description
            .slice(sectionStart + sectionHeader.length)
            .match(/\n---\s+/),
          sectionEnd = nextSectionMatch
            ? sectionStart + sectionHeader.length + nextSectionMatch.index
            : description.length,
          sectionText = description.slice(sectionStart, sectionEnd),
          migratedText = module.migrateConfigSection(sectionText);
        if (migratedText !== sectionText)
          ((description =
            description.slice(0, sectionStart) +
            migratedText +
            description.slice(sectionEnd)),
            (hasChanges = !0));
      }
      if (hasChanges) card.description = description;
    }
    loadConfig() {
      if (this.cachedConfig) return this.cachedConfig;
      let card = this.ensureConfigCard();
      if (!card) {
        let defaults = this.getDefaultSections(),
          defaultConfig = Object.values(defaults).join(`

`);
        return (
          (this.cachedConfig = parseConfig(defaultConfig, this.modules)),
          this.cachedConfig
        );
      }
      if (
        ((this.cachedConfig = parseConfig(
          card.description || "",
          this.modules
        )),
        this.cachedConfig.narrativeChecklist)
      ) {
        let nc = this.cachedConfig.narrativeChecklist;
      }
      return this.cachedConfig;
    }
    updateConfigValue(sectionName, key, value) {
      let card = findCard(CARD_TITLE);
      if (!card) return;
      let lines = (card.description || "").split(`
`),
        inSection = !1,
        updated = !1;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!line) continue;
        if (line.trim().startsWith("---")) {
          let normalizedLine = line.toLowerCase().replace(/\s+/g, ""),
            normalizedSection = sectionName.toLowerCase().replace(/\s+/g, "");
          inSection = normalizedLine.includes(normalizedSection);
          continue;
        }
        if (inSection) {
          let parsed = parseConfigLine(line);
          if (
            parsed.isValid &&
            parsed.key.toLowerCase() === key.toLowerCase()
          ) {
            let newLine = rebuildConfigLine(
              parsed.key,
              String(value),
              parsed.comment,
              parsed.hasComment
            );
            ((lines[i] = newLine), (updated = !0));
            break;
          }
        }
      }
      ((card.description = lines.join(`
`)),
        (this.cachedConfig = null));
    }
    createHooks() {
      let createAIContext = (moduleName) => {
        let aiState = this.getAIState();
        return {
          requestPrompt: (prompt, responseMarker) => {
            if (!aiState.promptQueue) aiState.promptQueue = [];
            if (!aiState.promptIdCounter) aiState.promptIdCounter = 0;
            let request = {
              id: `ai_prompt_${aiState.promptIdCounter++}`,
              moduleName,
              prompt,
              responseMarker,
            };
            if (aiState.activePrompt) {
              aiState.promptQueue.push(request);
              return;
            }
            if (typeof AutoCards === "function")
              try {
                AutoCards?.()?.API?.postponeEvents?.(3);
              } catch (e) {}
            aiState.activePrompt = request;
          },
          hasActivePrompt: () => aiState.activePrompt !== null,
          getResponse: (responseMarker) => {
            if (!aiState.responses) aiState.responses = {};
            return aiState.responses[responseMarker] || null;
          },
          clearResponse: (responseMarker) => {
            if (!aiState.responses) aiState.responses = {};
            delete aiState.responses[responseMarker];
          },
        };
      };
      return {
        onInput: (text) => {
          if (!text) return text;
          let config = this.loadConfig(),
            currentText = text,
            globalHistory = history || [],
            globalStoryCards = storyCards || [],
            globalInfo = info || {};
          for (let module of this.modules)
            if (module.hooks.onInput) {
              let moduleConfig = config[module.name];
              if (moduleConfig !== void 0) {
                let context = {
                  state: this.getModuleState(module.name),
                  updateConfig: (key, value) => {
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
          return currentText;
        },
        onContext: (text) => {
          if (!text) return text;
          let config = this.loadConfig(),
            currentText = text,
            globalHistory = history || [],
            globalStoryCards = storyCards || [],
            globalInfo = info || {};
          for (let module of this.modules)
            if (module.hooks.onContext) {
              let moduleConfig = config[module.name];
              if (moduleConfig !== void 0) {
                let context = {
                  state: this.getModuleState(module.name),
                  updateConfig: (key, value) => {
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
          let aiState = this.getAIState();
          if (aiState.activePrompt)
            currentText = currentText + aiState.activePrompt.prompt;
          return currentText;
        },
        onOutput: (text) => {
          if (!text) return text;
          let currentText = text,
            aiState = this.getAIState();
          if (aiState.activePrompt) {
            let { responseMarker } = aiState.activePrompt,
              markerPattern = new RegExp(
                `${responseMarker}:\\s*([^\\n]+)`,
                "i"
              ),
              match = currentText.match(markerPattern);
            if (match && match[1]) {
              if (!aiState.responses) aiState.responses = {};
              ((aiState.responses[responseMarker] = match[1].trim()),
                (currentText = currentText.replace(
                  new RegExp(`${responseMarker}:[^\\n]+\\n?`, "gi"),
                  ""
                )));
            }
            if (
              ((aiState.activePrompt = null),
              aiState.promptQueue && aiState.promptQueue.length > 0)
            ) {
              if (
                ((aiState.activePrompt = aiState.promptQueue.shift() || null),
                aiState.activePrompt && typeof AutoCards === "function")
              )
                try {
                  AutoCards?.()?.API?.postponeEvents?.(3);
                } catch (e) {}
            }
          }
          let config = this.loadConfig(),
            globalHistory = history || [],
            globalStoryCards = storyCards || [],
            globalInfo = info || {};
          for (let module of this.modules)
            if (module.hooks.onOutput) {
              let moduleConfig = config[module.name];
              if (moduleConfig !== void 0) {
                let context = {
                  state: this.getModuleState(module.name),
                  updateConfig: (key, value) => {
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
          return currentText;
        },
        reformatContext: (text) => {
          if (!text) return text;
          let config = this.loadConfig(),
            currentText = text,
            globalHistory = history || [],
            globalStoryCards = storyCards || [],
            globalInfo = info || {};
          for (let module of this.modules)
            if (module.hooks.onReformatContext) {
              let moduleConfig = config[module.name];
              if (moduleConfig !== void 0) {
                let context = {
                  state: this.getModuleState(module.name),
                  updateConfig: (key, value) => {
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
          return currentText;
        },
      };
    }
  }
  const DiceRoll = (() => {
    let DEFAULT_OUTCOME_LABELS = {
      S: "Critical Success!",
      s: "Success",
      p: "Partial Success",
      f: "Failure",
      F: "Critical Failure!",
    };
    function validateConfig(raw) {
      return {
        enable: booleanValidator(raw, "enable"),
        triggers: arrayValidator(raw, "triggers"),
        default: arrayValidator(raw, "default"),
        customSets: objectValidator(raw, "customsets"),
        outcomeLabels: objectValidator(
          raw,
          "outcomelabels",
          DEFAULT_OUTCOME_LABELS
        ),
      };
    }
    function roll(outcomes, labels) {
      let outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      return `[\uD83C\uDFB2 Dice Roll: ${outcome ? labels[outcome] || outcome : "Unknown"}]`;
    }
    function onInput(text, config, context) {
      if (!config.enable || !config.triggers.length) return text;
      let triggerPattern = config.triggers.map(escapeRegex).join("|");
      for (let [setName, setData] of Object.entries(config.customSets)) {
        if (!setData.words.length || !setData.outcomes.length) continue;
        let modifierPattern = setData.words.map(escapeRegex).join("|"),
          regex = new RegExp(
            `> (You (${modifierPattern}) (${triggerPattern})[^.?!]*[.?!])`,
            "i"
          ),
          match2 = text.match(regex);
        if (match2) {
          let outcome = roll(setData.outcomes, config.outcomeLabels);
          return text.replace(match2[0], `${match2[0].trim()} ${outcome}`);
        }
      }
      let defaultRegex = new RegExp(
          `> (You (${triggerPattern})[^.?!]*[.?!])`,
          "i"
        ),
        match = text.match(defaultRegex);
      if (match && config.default.length) {
        let outcome = roll(config.default, config.outcomeLabels);
        return text.replace(match[0], `${match[0].trim()} ${outcome}`);
      }
      return text;
    }
    return {
      name: "dice",
      configSection: `--- Dice ---
Enable: true  # Enable/disable dice rolling
# Trigger words that activate dice rolls:
Triggers: try, attempt, cast, attack, shoot, throw, brace yourself
# Default probability distribution (S=Crit Success, s=Success, p=Partial, f=Fail, F=Crit Fail):
Default: S s s s p f f F
# Outcome labels (customize the text for each outcome):
OutcomeLabels:
  S: Critical Success!
  s: Success
  p: Partial Success
  f: Failure
  F: Critical Failure!
# Custom probability sets:
Confident: S S s s s p p f f
Unconfident: s s p p f f f F F
# Words that trigger custom sets:
ConfidentWords: assuredly, confidently, doubtlessly, skillfully
UnconfidentWords: clumsily, tentatively, doubtfully, hesitantly, haphazardly`,
      validateConfig,
      hooks: { onInput },
    };
  })();
  function getLastAction() {
    if (!history || history.length === 0) return;
    return history[history.length - 1];
  }
  function getLastActionOfType(type) {
    if (!history) return;
    for (let i = history.length - 1; i >= 0; i--) {
      let action = history[i];
      if (action && action.type === type) return action;
    }
    return;
  }
  function isActionType(action, types) {
    if (!action) return !1;
    return (Array.isArray(types) ? types : [types]).includes(action.type);
  }
  const Paragraph = (() => {
    let FORMATTING_TYPES = ["none", "basic", "empty-line", "newline"];
    function validateConfig(raw) {
      return {
        enable: booleanValidator(raw, "enable"),
        formattingType: enumValidator(
          raw,
          "formattingtype",
          FORMATTING_TYPES,
          "none"
        ),
        indentParagraphs: booleanValidator(raw, "indentparagraphs"),
      };
    }
    function adjustNewlines(text, prevAction) {
      if (!prevAction) return text;
      if (isActionType(prevAction, ["do", "say", "see"])) return text;
      let prevText = prevAction.text || prevAction.rawText || "",
        endNewlines = Math.min(2, (prevText.match(/\n*$/)?.[0] || "").length),
        startNewlines = Math.min(2, (text.match(/^\n*/)?.[0] || "").length);
      if (endNewlines + startNewlines === 1)
        return (
          `
` + text
        );
      return text;
    }
    function applyIndentation(text, prevAction) {
      if (!prevAction) return text;
      if (isActionType(prevAction, ["do", "say", "see"]))
        return text
          .split(
            `
`
          )
          .map((line) => {
            let trimmed = line.trimStart();
            if (
              trimmed.startsWith(">") ||
              trimmed === "" ||
              line.startsWith("    ")
            )
              return line;
            return "    " + line;
          }).join(`
`);
      else
        return text.replace(
          /\n\n(\s*)(?=\S)(?!>)/g,
          `

    `
        );
    }
    function onContext(text, config, context) {
      return text.replace(/^    /gm, "");
    }
    function onOutput(text, config, context) {
      if (!config.enable || config.formattingType === "none") return text;
      switch (config.formattingType) {
        case "basic":
          text = text.replace(
            /\s{2,}|\n/g,
            `

`
          );
          break;
        case "empty-line":
          text = text.replace(
            /(?<!,) (?=")|\s{2,}|\n/g,
            `

`
          );
          break;
        case "newline":
          text = text
            .replace(
              /\s{2,}|\n/g,
              `

`
            )
            .replace(
              /(?<!,) (?=")/g,
              `
`
            );
          break;
      }
      let prevAction =
        context.history.length > 0
          ? context.history[context.history.length - 1] || null
          : null;
      if (((text = adjustNewlines(text, prevAction)), config.indentParagraphs))
        text = applyIndentation(text, prevAction);
      return text;
    }
    return {
      name: "paragraph",
      configSection: `--- Paragraph ---
Enable: true  # Enable/disable paragraph formatting
# FormattingType options: none, basic, empty-line, newline
# - none: No formatting
# - basic: Converts multiple spaces/newlines to double newlines
# - empty-line: Basic + adds spacing before quotes (except after commas)
# - newline: Basic + newlines before quotes
FormattingType: none
IndentParagraphs: false  # Add 4-space indents to paragraphs`,
      validateConfig,
      hooks: { onContext, onOutput },
    };
  })();
  const QUOTE_PAIRS = [
    ['"', '"'],
    ["‹", "›"],
    ["«", "»"],
    ["「", "」"],
    ["『", "』"],
  ];
  function splitIntoSentences(text) {
    let sentences = [],
      currentSentence = "",
      inQuote = !1,
      expectedClosing = "";
    for (let i = 0; i < text.length; i++) {
      let char = text[i];
      if (!char) continue;
      if (((currentSentence += char), !inQuote)) {
        let pair = QUOTE_PAIRS.find((p) => p[0] === char);
        if (pair && pair[1]) ((inQuote = !0), (expectedClosing = pair[1]));
      } else if (char === expectedClosing)
        ((inQuote = !1), (expectedClosing = ""));
      if (!inQuote && /[.!?。！？]/.test(char)) {
        let isCJK = /[。！？]/.test(char),
          nextChar = i + 1 < text.length ? text[i + 1] : void 0;
        if (isCJK || !nextChar || /\s/.test(nextChar))
          (sentences.push(currentSentence.trim()), (currentSentence = ""));
      }
    }
    if (currentSentence.trim()) sentences.push(currentSentence.trim());
    return sentences.filter((s) => s.length > 0);
  }
  function levenshteinDistance(str1, str2) {
    let len1 = str1.length,
      len2 = str2.length,
      matrix = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) {
      let row0 = matrix[0];
      if (row0) row0[j] = j;
    }
    for (let i = 1; i <= len1; i++)
      for (let j = 1; j <= len2; j++) {
        let cost = str1[i - 1] === str2[j - 1] ? 0 : 1,
          currRow = matrix[i],
          prevRow = matrix[i - 1],
          currCell = matrix[i]?.[j - 1],
          prevCell = matrix[i - 1]?.[j],
          diagCell = matrix[i - 1]?.[j - 1];
        if (
          currRow &&
          prevRow !== void 0 &&
          currCell !== void 0 &&
          prevCell !== void 0 &&
          diagCell !== void 0
        )
          currRow[j] = Math.min(prevCell + 1, currCell + 1, diagCell + cost);
      }
    return matrix[len1]?.[len2] ?? 0;
  }
  function calculateSimilarity(str1, str2) {
    let maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;
    let distance = levenshteinDistance(str1, str2);
    return ((maxLength - distance) / maxLength) * 100;
  }
  function calculateSimilarityWithContinuation(str1, str2) {
    let normalSimilarity = calculateSimilarity(str1, str2);
    if (
      Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length) >
      0.7
    )
      return normalSimilarity;
    let shorter = str1.length < str2.length ? str1 : str2,
      longer = str1.length < str2.length ? str2 : str1,
      normalizeForComparison = (text) => {
        return text
          .replace(/["‹›«»「」『』]/g, "")
          .replace(/[.!?,]+\s*$/, "")
          .trim();
      },
      shorterCore = normalizeForComparison(shorter),
      longerCore = normalizeForComparison(longer),
      shorterLower = shorterCore.toLowerCase(),
      longerLower = longerCore.toLowerCase();
    if (longerLower.startsWith(shorterLower)) {
      let matchRatio = shorterCore.length / shorter.length;
      return Math.max(normalSimilarity, 70 + matchRatio * 20);
    }
    if (longerLower.includes(shorterLower)) {
      if (shorterCore.length / longerCore.length >= 0.5) {
        let matchRatio = shorterCore.length / shorter.length;
        return Math.max(normalSimilarity, 70 + matchRatio * 20);
      }
    }
    let prefixLength = Math.min(longer.length, shorter.length + 20),
      prefix = longer.substring(0, prefixLength),
      prefixSimilarity = calculateSimilarity(shorter, prefix);
    return Math.max(normalSimilarity, prefixSimilarity);
  }
  function findSentenceOverlap(
    sentences1,
    sentences2,
    similarityThreshold = 70
  ) {
    let maxToCheck = Math.min(3, sentences1.length, sentences2.length),
      bestOverlapCount = 0,
      bestTotalSimilarity = 0;
    for (let overlapSize = maxToCheck; overlapSize >= 1; overlapSize--) {
      let lastSentences1 = sentences1.slice(-overlapSize),
        firstSentences2 = sentences2.slice(0, overlapSize),
        totalSimilarity = 0,
        allAboveThreshold = !0;
      for (let i = 0; i < overlapSize; i++) {
        let sent1 = lastSentences1[i],
          sent2 = firstSentences2[i];
        if (!sent1 || !sent2) {
          allAboveThreshold = !1;
          break;
        }
        let similarity = calculateSimilarityWithContinuation(
          sent1.toLowerCase(),
          sent2.toLowerCase()
        );
        if (
          ((totalSimilarity += similarity), similarity < similarityThreshold)
        ) {
          allAboveThreshold = !1;
          break;
        }
      }
      if (allAboveThreshold && totalSimilarity > bestTotalSimilarity)
        ((bestOverlapCount = overlapSize),
          (bestTotalSimilarity = totalSimilarity));
    }
    return bestOverlapCount;
  }
  function checkAndMerge(
    previousMessage,
    currentMessage,
    similarityThreshold = 70
  ) {
    if (!previousMessage || !currentMessage) return { shouldMerge: !1 };
    let prevTrimmed = previousMessage.trim(),
      currTrimmed = currentMessage.trim();
    if (calculateSimilarity(prevTrimmed, currTrimmed) > 90)
      return {
        shouldMerge: !0,
        mergedContent:
          prevTrimmed.length >= currTrimmed.length ? prevTrimmed : currTrimmed,
        reason: "full-duplicate",
      };
    let sentences1 = splitIntoSentences(prevTrimmed),
      sentences2 = splitIntoSentences(currTrimmed),
      overlapCount = findSentenceOverlap(
        sentences1,
        sentences2,
        similarityThreshold
      );
    if (overlapCount > 0) {
      if (sentences2.slice(overlapCount).length === 0)
        return {
          shouldMerge: !0,
          mergedContent: currTrimmed,
          reason: "sentence-overlap",
        };
      let searchPos = 0;
      for (let i = 0; i < overlapCount; i++) {
        let sentence = sentences2[i];
        if (sentence) {
          let foundPos = currTrimmed.indexOf(sentence, searchPos);
          if (foundPos !== -1) searchPos = foundPos + sentence.length;
        }
      }
      return {
        shouldMerge: !0,
        mergedContent: currTrimmed.substring(searchPos).trim(),
        reason: "sentence-overlap",
      };
    }
    return { shouldMerge: !1 };
  }
  const Redundancy = (() => {
    function validateConfig(raw) {
      return {
        enable: booleanValidator(raw, "enable"),
        similarityThreshold: numberValidator(
          raw,
          "similaritythreshold",
          { min: 0, max: 100, integer: !0 },
          70
        ),
      };
    }
    function onOutput(text, config, context) {
      if (!config.enable) return text;
      let lastAIMessage;
      for (let i = context.history.length - 1; i >= 0; i--) {
        let action = context.history[i];
        if (action && isActionType(action, ["continue"])) {
          lastAIMessage = action;
          break;
        }
      }
      if (!lastAIMessage) return text;
      let lastText = lastAIMessage.text || "",
        result = checkAndMerge(lastText, text, config.similarityThreshold);
      if (result.shouldMerge && result.mergedContent)
        return result.mergedContent;
      return text;
    }
    return {
      name: "redundancy",
      configSection: `--- Redundancy ---
Enable: true  # Enable/disable redundancy detection and merging
# Similarity threshold (0-100) for fuzzy sentence matching:
SimilarityThreshold: 70`,
      validateConfig,
      hooks: { onOutput },
    };
  })();
  const BetterYou = (() => {
    function validateConfig(raw) {
      let rawReplacements = objectValidator(raw, "replacements", {}),
        replacements = {};
      for (let [key, value] of Object.entries(rawReplacements))
        if (typeof value === "string") replacements[key] = value;
      let rawPatterns = objectValidator(raw, "patterns", {}),
        patterns = {};
      for (let [key, value] of Object.entries(rawPatterns))
        if (typeof value === "string") patterns[key] = value;
      return {
        enable: booleanValidator(raw, "enable"),
        replacements,
        patterns,
      };
    }
    function applyPatterns(line, patterns) {
      let result = line;
      for (let [from, to] of Object.entries(patterns)) {
        let regex = new RegExp(escapeRegex(from), "g");
        result = result.replace(regex, to);
      }
      return result;
    }
    function replaceOutsideQuotes(line, replacements) {
      let parts = line.split('"');
      for (let i = 0; i < parts.length; i += 2) {
        let part = parts[i];
        if (part) {
          for (let [from, to] of Object.entries(replacements)) {
            let regex = new RegExp(`\\b${escapeRegex(from)}\\b`, "g");
            part = part.replace(regex, to);
          }
          parts[i] = part;
        }
      }
      return parts.join('"');
    }
    function onInput(text, config, context) {
      if (!config.enable) return text;
      if (
        Object.keys(config.replacements).length === 0 &&
        Object.keys(config.patterns).length === 0
      )
        return text;
      let lines = text.split(`
`);
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!line) continue;
        if (!line.match(/^>\s*You\b/) && !line.match(/^>\s*"/)) continue;
        let processedLine = line;
        if (Object.keys(config.patterns).length > 0)
          processedLine = applyPatterns(processedLine, config.patterns);
        if (Object.keys(config.replacements).length > 0)
          processedLine = replaceOutsideQuotes(
            processedLine,
            config.replacements
          );
        lines[i] = processedLine;
      }
      return lines.join(`
`);
    }
    return {
      name: "betterYou",
      configSection: `--- Better You ---
Enable: true  # Enable/disable pronoun replacements
# Replace words outside of dialogue (respects word boundaries):
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours
# Pattern replacements applied everywhere (including dialogue):
Patterns:
  . you: . You
  ." you: ." You`,
      validateConfig,
      hooks: { onInput },
    };
  })();
  const SECTION_PATTERNS = [
    { name: "World Lore", pattern: /^(#{1,4}\s+)?World Lore:?/im },
    { name: "Story Summary", pattern: /^(#{1,4}\s+)?Story Summary:?/im },
    { name: "Memories", pattern: /^(#{1,4}\s+)?Memories:?/im },
    {
      name: "Narrative Checklist",
      pattern: /^(#{1,4}\s+)?Narrative Checklist:?/im,
    },
    { name: "Recent Story", pattern: /^(#{1,4}\s+)?Recent Story:?/im },
    {
      name: "Author's Note",
      pattern: /^(#{1,4}\s+)?(\[?)Author'?s?\s+[Nn]ote:?/im,
    },
  ];
  function parseContextSections(text) {
    let sections = [];
    for (let { name, pattern } of SECTION_PATTERNS) {
      let match = pattern.exec(text);
      if (match)
        sections.push({
          name,
          header: match[0],
          startIndex: match.index,
          endIndex: -1,
          content: "",
        });
    }
    sections.sort((a, b) => a.startIndex - b.startIndex);
    for (let i = 0; i < sections.length; i++) {
      let section = sections[i];
      if (!section) continue;
      let nextSection = sections[i + 1];
      ((section.endIndex = nextSection ? nextSection.startIndex : text.length),
        (section.content = text.slice(section.startIndex, section.endIndex)));
    }
    return sections;
  }
  function findMatchingBracket(text, startIndex) {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++)
      if (text[i] === "[") depth++;
      else if (text[i] === "]") {
        if ((depth--, depth === 0)) return i;
      }
    return -1;
  }
  function replaceHeaders(text, headerMap) {
    let result = text;
    for (let [oldHeader, newHeader] of Object.entries(headerMap))
      if (oldHeader === "[Author's note:") {
        let pattern = /^\[Author's note:/gim,
          match;
        while ((match = pattern.exec(result)) !== null) {
          let startIndex = match.index,
            closingBracketIndex = findMatchingBracket(result, startIndex);
          if (closingBracketIndex !== -1) {
            let innerContent = result
                .slice(startIndex + match[0].length, closingBracketIndex)
                .trim(),
              replacement = `${newHeader}
${innerContent}`;
            ((result =
              result.slice(0, startIndex) +
              replacement +
              result.slice(closingBracketIndex + 1)),
              (pattern.lastIndex = startIndex + replacement.length));
          }
        }
      } else {
        let pattern = new RegExp(`^${escapeRegex2(oldHeader)}`, "gim");
        result = result.replace(pattern, newHeader);
      }
    return result;
  }
  function injectSection(text, sectionName, content, options) {
    let sections = parseContextSections(text),
      existingSection = sections.find((s) => s.name === sectionName);
    if (existingSection) {
      let before = text.slice(0, existingSection.startIndex),
        after = text.slice(existingSection.endIndex);
      return before + content + after;
    }
    if (options?.beforeSection) {
      let targetSection = sections.find(
        (s) => s.name === options.beforeSection
      );
      if (targetSection) {
        let before = text.slice(0, targetSection.startIndex),
          after = text.slice(targetSection.startIndex);
        return (
          before +
          content +
          `

` +
          after
        );
      }
      return text;
    }
    if (options?.afterSection) {
      let targetSection = sections.find((s) => s.name === options.afterSection);
      if (targetSection) {
        let before = text.slice(0, targetSection.endIndex),
          after = text.slice(targetSection.endIndex);
        return (
          before +
          `

` +
          content +
          after
        );
      }
    }
    return (
      text +
      `

` +
      content
    );
  }
  function truncateSection(text, sectionName, minChars) {
    let section = parseContextSections(text).find(
      (s) => s.name === sectionName
    );
    if (!section || section.content.length <= minChars) return text;
    let headerMatch = section.content.match(/^[^\n]+\n/),
      header = headerMatch ? headerMatch[0] : "",
      body = section.content.slice(header.length);
    if (body.length <= minChars) return text;
    let truncated = body.slice(body.length - minChars),
      newContent = header + truncated,
      before = text.slice(0, section.startIndex),
      after = text.slice(section.endIndex);
    return before + newContent + after;
  }
  function getSectionContent(text, sectionName) {
    let section = parseContextSections(text).find(
      (s) => s.name === sectionName
    );
    return section ? section.content : null;
  }
  function escapeRegex2(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const MarkdownHeaders = (() => {
    function validateConfig(raw) {
      return {
        enable: booleanValidator(raw, "enable", !0),
        headerLevel: stringValidator(raw, "headerlevel", "##"),
      };
    }
    function onReformatContext(text, config, context) {
      if (!config.enable) return text;
      let headerMap = {
        "World Lore:": `${config.headerLevel} World Lore`,
        "Story Summary:": `${config.headerLevel} Story Summary`,
        "Memories:": `${config.headerLevel} Memories`,
        "Narrative Checklist:": `${config.headerLevel} Narrative Checklist`,
        "Recent Story:": `${config.headerLevel} Recent Story`,
        "[Author's note:": `${config.headerLevel}# Author's Note:`,
      };
      return replaceHeaders(text, headerMap);
    }
    return {
      name: "markdownHeaders",
      configSection: `--- Markdown Headers ---
Enable: true  # Replace plain text headers with markdown
HeaderLevel: ##  # Markdown header level (## or ###)`,
      validateConfig,
      hooks: { onReformatContext },
    };
  })();
  const CHECKLIST_CARD_TITLE = "Narrative Checklist",
    CHECKLIST_CARD_KEYS = "narrative checklist",
    MIN_ACTION_PROGRESS = 3,
    NarrativeChecklist = (() => {
      function getTypedState(state2) {
        return state2;
      }
      function validateConfig(raw) {
        let maxTurns = numberValidator(
          raw,
          "maxturnsbeforecheck",
          { min: 1 },
          0
        );
        if (maxTurns === 0)
          maxTurns = numberValidator(
            raw,
            "minturnsbeforecheck",
            { min: 1 },
            50
          );
        return {
          enable: booleanValidator(raw, "enable", !0),
          maxTurnsBeforeCheck: maxTurns,
          remainingTurns: numberValidator(
            raw,
            "remainingturns",
            { min: 0 },
            maxTurns
          ),
          alwaysIncludeInContext: booleanValidator(
            raw,
            "alwaysincludeincontext",
            !0
          ),
          minContextChars: numberValidator(
            raw,
            "mincontextchars",
            { min: 100 },
            2000
          ),
        };
      }
      function ensureChecklistCard() {
        let card = findCard(CHECKLIST_CARD_TITLE);
        if (!card) {
          if (
            ((card =
              addStoryCard(
                CHECKLIST_CARD_KEYS,
                void 0,
                void 0,
                void 0,
                void 0,
                { returnCard: !0 }
              ) ?? void 0),
            card)
          )
            ((card.title = CHECKLIST_CARD_TITLE),
              (card.type = "class"),
              (card.entry = `- [ ] Example checklist item
- [ ] Another item to track`));
        }
        return card;
      }
      function parseChecklistItems(entry) {
        let items = [],
          lines = entry.split(`
`);
        for (let line of lines) {
          let checkedMatch = line.match(/^- \[x\] (.+)$/i),
            uncheckedMatch = line.match(/^- \[ \] (.+)$/);
          if (checkedMatch && checkedMatch[1])
            items.push({ checked: !0, text: checkedMatch[1] });
          else if (uncheckedMatch && uncheckedMatch[1])
            items.push({ checked: !1, text: uncheckedMatch[1] });
        }
        return items;
      }
      function formatChecklistItems(items) {
        return items.map(
          (item) => `- [${item.checked ? "x" : " "}] ${item.text}`
        ).join(`
`);
      }
      function onInput(text, config, context) {
        if (!config.enable) return text;
        let typedState = getTypedState(context.state);
        if (typedState.checklistCardId === void 0)
          typedState.checklistCardId = null;
        if (typedState.minBoundaryReached === void 0)
          typedState.minBoundaryReached = !1;
        if (typedState.minBoundaryActionText === void 0)
          typedState.minBoundaryActionText = null;
        if (typedState.boundaryActionCount === void 0)
          typedState.boundaryActionCount = null;
        if (typedState.shouldTriggerCheck === void 0)
          typedState.shouldTriggerCheck = !1;
        let card = ensureChecklistCard();
        if (card && typedState.checklistCardId !== card.id)
          typedState.checklistCardId = card.id;
        return text;
      }
      function onOutput(text, config, context) {
        if (!config.enable) return text;
        let typedState = getTypedState(context.state),
          card = ensureChecklistCard(),
          response = context.ai.getResponse("CHECKLIST_UPDATE");
        if (response && card) {
          let completedIndices = parseCompletionResponse(response),
            allItems = parseChecklistItems(card.entry || ""),
            unchecked = allItems.filter((item) => !item.checked);
          (updateChecklistWithCompletions(
            card,
            allItems,
            unchecked,
            completedIndices
          ),
            context.ai.clearResponse("CHECKLIST_UPDATE"));
        }
        if (
          typedState.shouldTriggerCheck &&
          card &&
          !context.ai.hasActivePrompt()
        ) {
          let uncheckedItems = parseChecklistItems(card.entry || "").filter(
            (item) => !item.checked
          );
          if (uncheckedItems.length > 0) {
            let prompt = `

<<SYSTEM: Review the narrative checklist below against recent events. If any items are clearly completed, respond ONLY with "CHECKLIST_UPDATE: [numbers]" (e.g., "CHECKLIST_UPDATE: 1, 3"). If none are completed, respond with "CHECKLIST_UPDATE: none". Then continue the story.

Narrative Checklist:
${uncheckedItems.map((item, idx) => `${idx + 1}. ${item.text}`).join(`
`)}>>`;
            context.ai.requestPrompt(prompt, "CHECKLIST_UPDATE");
          }
          ((typedState.shouldTriggerCheck = !1),
            (typedState.minBoundaryReached = !1),
            (typedState.minBoundaryActionText = null),
            (typedState.boundaryActionCount = null),
            context.updateConfig("remainingTurns", config.maxTurnsBeforeCheck));
        } else if (!typedState.minBoundaryReached) {
          let newRemainingTurns = config.remainingTurns - 1;
          if (newRemainingTurns <= 0) {
            ((typedState.minBoundaryReached = !0),
              (typedState.boundaryActionCount = context.info.actionCount));
            let recentHistory = context.history[context.history.length - 1];
            if (recentHistory && recentHistory.text) {
              let boundaryText = recentHistory.text.slice(0, 200);
              typedState.minBoundaryActionText = boundaryText;
            }
            context.updateConfig("remainingTurns", 0);
          } else context.updateConfig("remainingTurns", newRemainingTurns);
        } else {
          let actionsSinceBoundary =
              typedState.boundaryActionCount !== null
                ? context.info.actionCount - typedState.boundaryActionCount
                : 0,
            hasMaxTurnsElapsed =
              config.remainingTurns <= -config.maxTurnsBeforeCheck,
            hasMinActionsProgressed =
              actionsSinceBoundary >= MIN_ACTION_PROGRESS;
          if (hasMaxTurnsElapsed && card && !context.ai.hasActivePrompt())
            typedState.shouldTriggerCheck = !0;
          context.updateConfig("remainingTurns", config.remainingTurns - 1);
        }
        return text;
      }
      function parseCompletionResponse(response) {
        let normalized = response.toLowerCase().trim();
        if (normalized === "none" || normalized === "") return [];
        let numbers = normalized.match(/\d+/g);
        if (!numbers) return [];
        return numbers.map((n) => parseInt(n, 10));
      }
      function updateChecklistWithCompletions(
        card,
        allItems,
        uncheckedItems,
        completedIndices
      ) {
        for (let index of completedIndices)
          if (index >= 1 && index <= uncheckedItems.length) {
            let itemToComplete = uncheckedItems[index - 1];
            if (itemToComplete) {
              let itemIndex = allItems.findIndex(
                (item) => item.text === itemToComplete.text
              );
              if (itemIndex !== -1 && allItems[itemIndex])
                allItems[itemIndex].checked = !0;
            }
          }
        card.entry = formatChecklistItems(allItems);
      }
      function onReformatContext(text, config, context) {
        if (!config.enable) return text;
        let typedState = getTypedState(context.state);
        if (typedState.minBoundaryReached && typedState.minBoundaryActionText) {
          let boundaryInContext = text.includes(
              typedState.minBoundaryActionText
            ),
            hasMinActionsProgressed =
              (typedState.boundaryActionCount !== null
                ? context.info.actionCount - typedState.boundaryActionCount
                : 0) >= MIN_ACTION_PROGRESS;
          if (!boundaryInContext && hasMinActionsProgressed)
            typedState.shouldTriggerCheck = !0;
        }
        if (!config.alwaysIncludeInContext) return text;
        let recentStorySection = getSectionContent(text, "Recent Story");
        if (!recentStorySection) return text;
        let card = ensureChecklistCard();
        if (!card || !card.entry) return text;
        let checklistContent = `Narrative Checklist:
${card.entry}`;
        text = injectSection(text, "Narrative Checklist", checklistContent, {
          beforeSection: "Recent Story",
        });
        let maxChars = context.info.maxChars;
        if (maxChars && text.length > maxChars) {
          let overage = text.length - maxChars,
            targetRecentStoryLength = Math.max(
              config.minContextChars,
              recentStorySection.length - overage
            );
          text = truncateSection(text, "Recent Story", targetRecentStoryLength);
        }
        return text;
      }
      function migrateConfigSection(sectionText) {
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
        hooks: { onInput, onOutput, onReformatContext },
        initialState: {
          checklistCardId: null,
          minBoundaryReached: !1,
          minBoundaryActionText: null,
          boundaryActionCount: null,
          shouldTriggerCheck: !1,
        },
        migrateConfigSection,
      };
    })();
  const DEBUG_TEMP_CARD_KEYS = "foxtweaks_debug_temp";
  function storeTempDebugData(hookType, text) {
    if (findStoryCard((c) => c.type === `debug_temp_${hookType}`)) {
      let index = findStoryCardIndex(
        (c) => c.type === `debug_temp_${hookType}`
      );
      if (index !== -1) updateStoryCard(index, DEBUG_TEMP_CARD_KEYS, text);
    } else {
      let card = addStoryCard(
        DEBUG_TEMP_CARD_KEYS,
        text,
        `debug_temp_${hookType}`,
        void 0,
        void 0,
        { returnCard: !0 }
      );
      if (card) card.type = `debug_temp_${hookType}`;
    }
  }
  const DebugStart = (() => {
      function validateConfig(raw) {
        return { enableDebugCards: booleanValidator(raw, "enabledebugcards") };
      }
      function onInput(text, config, context) {
        if (config.enableDebugCards) storeTempDebugData("input", text);
        return text;
      }
      function onContext(text, config, context) {
        if (config.enableDebugCards) storeTempDebugData("context", text);
        return text;
      }
      function onOutput(text, config, context) {
        if (config.enableDebugCards) storeTempDebugData("output", text);
        return text;
      }
      return {
        name: "debug",
        configSection: `--- Debug ---
EnableDebugCards: false  # Enable/disable debug story cards showing hook text transformations`,
        validateConfig,
        hooks: { onInput, onContext, onOutput },
      };
    })(),
    DebugEnd = (() => {
      function validateConfig(raw) {
        return { enableDebugCards: booleanValidator(raw, "enabledebugcards") };
      }
      function createOrUpdateDebugCard(hookType, originalText, finalText) {
        let cardTitle = `${hookType.charAt(0).toUpperCase() + hookType.slice(1)} Debug`,
          cardContent = `Original ${hookType} text:
\`\`\`
${originalText || "(empty)"}
\`\`\`

Resulting ${hookType} text:
\`\`\`
${finalText || "(empty)"}
\`\`\`

Changed: ${originalText !== finalText ? "Yes" : "No"}`;
        if (findStoryCard((c) => c.type === `debug_${hookType}`)) {
          let index = findStoryCardIndex((c) => c.type === `debug_${hookType}`);
          if (index !== -1) {
            updateStoryCard(index, "foxtweaks_debug", cardContent);
            let card = storyCards[index];
            if (card)
              ((card.title = cardTitle), (card.type = `debug_${hookType}`));
          }
        } else {
          let card = addStoryCard(
            "foxtweaks_debug",
            cardContent,
            `debug_${hookType}`,
            cardTitle,
            "FoxTweaks debug information",
            { returnCard: !0 }
          );
          if (card) card.title = cardTitle;
        }
      }
      function processDebugHook(text, config, hookType) {
        if (!config.enableDebugCards) return text;
        let tempCard = findStoryCard(
          (c) => c.type === `debug_temp_${hookType}`
        );
        if (tempCard && tempCard.entry) {
          let originalText = tempCard.entry;
          createOrUpdateDebugCard(hookType, originalText, text);
          let tempIndex = findStoryCardIndex(
            (c) => c.type === `debug_temp_${hookType}`
          );
          if (tempIndex !== -1) removeStoryCard(tempIndex);
        }
        return text;
      }
      function onInput(text, config, context) {
        return processDebugHook(text, config, "input");
      }
      function onContext(text, config, context) {
        return processDebugHook(text, config, "context");
      }
      function onOutput(text, config, context) {
        return processDebugHook(text, config, "output");
      }
      return {
        name: "debug",
        configSection: "",
        validateConfig,
        hooks: { onInput, onContext, onOutput },
      };
    })();
  const core = new FoxTweaks();
  core.registerModule(DebugStart);
  core.registerModule(DiceRoll);
  core.registerModule(Interject);
  core.registerModule(Paragraph);
  core.registerModule(Redundancy);
  core.registerModule(BetterYou);
  core.registerModule(NarrativeChecklist);
  core.registerModule(MarkdownHeaders);
  core.registerModule(DebugEnd);
  const hooks = core.createHooks(),
    FoxTweaks2 = {
      Hooks: {
        onInput: hooks.onInput,
        onContext: hooks.onContext,
        onOutput: hooks.onOutput,
        reformatContext: hooks.reformatContext,
      },
      Utils: {
        pinAndSortCards,
        findCard,
        getLastAction,
        getLastActionOfType,
        splitIntoSentences,
        calculateSimilarity,
      },
    },
    library_default = FoxTweaks2;
  return library_default;
})();
