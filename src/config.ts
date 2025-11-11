import type { Module, ParsedConfigLine } from "./types";
import { parseBool } from "./utils/string";

/**
 * Parses a single configuration line
 * @param line - The line to parse
 * @returns Parsed line components
 */
export function parseConfigLine(line: string): ParsedConfigLine {
  const commentIdx = line.indexOf("#");
  const hasComment = commentIdx >= 0;
  const effectiveLine = hasComment ? line.substring(0, commentIdx) : line;
  const comment = hasComment ? line.substring(commentIdx) : "";
  const trimmed = effectiveLine.trim();

  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) {
    return { key: "", value: "", comment, hasComment, isValid: false };
  }

  const key = trimmed.substring(0, colonIdx).trim();
  const value = trimmed.substring(colonIdx + 1).trim();

  return { key, value, comment, hasComment, isValid: true };
}

/**
 * Rebuilds a configuration line from components
 * @param key - The config key
 * @param value - The config value
 * @param comment - Optional comment
 * @param hasComment - Whether a comment was present
 * @returns Formatted config line
 */
export function rebuildConfigLine(
  key: string,
  value: string,
  comment: string,
  hasComment: boolean
): string {
  const base = `${key}: ${value}`;
  if (hasComment) {
    return base + "  " + comment;
  }
  return base;
}

interface ParseContext {
  currentSection: string | null;
  currentModule: Module<unknown> | null;
  inReplacements: boolean;
  rawConfig: Record<string, Record<string, unknown>>;
}

/**
 * Parses dice roll configuration from raw config
 * @param raw - Raw configuration object
 * @returns Parsed dice roll config
 */
function parseDiceConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enable: false,
    triggers: [],
    default: [],
    customSets: {},
  };

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "enable") {
      config.enable = typeof value === "string" ? parseBool(value) : value;
    } else if (lowerKey === "triggers") {
      config.triggers =
        typeof value === "string"
          ? value.split(",").map((s) => s.trim()).filter(Boolean)
          : value;
    } else if (lowerKey === "default") {
      config.default =
        typeof value === "string"
          ? value.split(/\s+/).filter(Boolean)
          : value;
    } else if (lowerKey.endsWith("words")) {
      const setName = key.slice(0, -5);
      if (!config.customSets) config.customSets = {};
      const sets = config.customSets as Record<string, { outcomes: string[]; words: string[] }>;
      if (!sets[setName]) {
        sets[setName] = { outcomes: [], words: [] };
      }
      sets[setName].words =
        typeof value === "string"
          ? value.split(",").map((s) => s.trim()).filter(Boolean)
          : (value as string[]);
    } else {
      if (!config.customSets) config.customSets = {};
      const sets = config.customSets as Record<string, { outcomes: string[]; words: string[] }>;
      if (!sets[key]) {
        sets[key] = { outcomes: [], words: [] };
      }
      sets[key].outcomes =
        typeof value === "string"
          ? value.split(/\s+/).filter(Boolean)
          : (value as string[]);
    }
  }

  return config;
}

/**
 * Parses interject configuration from raw config
 * @param raw - Raw configuration object
 * @returns Parsed interject config
 */
function parseInterjectConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enable: false,
    maxTurns: 3,
    remainingTurns: 0,
  };

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "enable") {
      config.enable = typeof value === "string" ? parseBool(value) : value;
    } else if (lowerKey === "maxturns") {
      const parsed = typeof value === "string" ? parseInt(value) : value;
      if (typeof parsed === "number" && !isNaN(parsed) && parsed > 0) {
        config.maxTurns = parsed;
      }
    } else if (lowerKey === "remainingturns") {
      const parsed = typeof value === "string" ? parseInt(value) : value;
      if (typeof parsed === "number" && !isNaN(parsed) && parsed >= 0) {
        config.remainingTurns = parsed;
      }
    }
  }

  return config;
}

/**
 * Parses paragraph configuration from raw config
 * @param raw - Raw configuration object
 * @returns Parsed paragraph config
 */
function parseParagraphConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enable: false,
    formattingType: "none",
    indentParagraphs: false,
  };

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "enable") {
      config.enable = typeof value === "string" ? parseBool(value) : value;
    } else if (lowerKey === "formattingtype") {
      if (
        typeof value === "string" &&
        ["none", "basic", "empty-line", "newline"].includes(value)
      ) {
        config.formattingType = value;
      }
    } else if (lowerKey === "indentparagraphs") {
      config.indentParagraphs = typeof value === "string" ? parseBool(value) : value;
    }
  }

  return config;
}

/**
 * Parses redundancy configuration from raw config
 * @param raw - Raw configuration object
 * @returns Parsed redundancy config
 */
function parseRedundancyConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enable: false,
    similarityThreshold: 70,
  };

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "enable") {
      config.enable = typeof value === "string" ? parseBool(value) : value;
    } else if (lowerKey === "similaritythreshold") {
      const parsed = typeof value === "string" ? parseInt(value) : value;
      if (typeof parsed === "number" && !isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        config.similarityThreshold = parsed;
      }
    }
  }

  return config;
}

/**
 * Parses BetterYou configuration from raw config
 * @param raw - Raw configuration object
 * @returns Parsed BetterYou config
 */
function parseBetterYouConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {
    enable: false,
    replacements: {},
  };

  let inReplacements = false;

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "enable") {
      config.enable = typeof value === "string" ? parseBool(value) : value;
    } else if (lowerKey === "replacements") {
      inReplacements = true;
      if (typeof value === "object" && value !== null) {
        config.replacements = value;
      }
    } else if (inReplacements || lowerKey !== "enable") {
      (config.replacements as Record<string, string>)[key] = String(value);
    }
  }

  return config;
}

/**
 * Parses configuration from description text
 * @param description - Configuration description text
 * @param modules - Array of registered modules
 * @returns Parsed and validated configuration object
 */
export function parseConfig<T extends Record<string, unknown>>(
  description: string,
  modules: Module<unknown>[]
): T {
  const lines = description.split("\n");
  const context: ParseContext = {
    currentSection: null,
    currentModule: null,
    inReplacements: false,
    rawConfig: {},
  };

  for (const module of modules) {
    context.rawConfig[module.name] = {};
  }

  for (const line of lines) {
    const parsed = parseConfigLine(line);

    if (!parsed.isValid && line.trim() && !line.trim().startsWith("#")) {
      continue;
    }
    if (!parsed.isValid) continue;

    if (parsed.key.startsWith("---")) {
      const sectionName = parsed.key.replace(/---/g, "").trim().toLowerCase();

      context.currentModule = null;
      context.inReplacements = false;

      for (const module of modules) {
        if (
          sectionName.includes(module.name.toLowerCase()) ||
          (module.name === "redundancy" && sectionName.includes("dedup")) ||
          (module.name === "betterYou" &&
            (sectionName.includes("better") || sectionName.includes("you")))
        ) {
          context.currentSection = module.name;
          context.currentModule = module;
          break;
        }
      }

      continue;
    }

    if (!context.currentSection || !context.currentModule) continue;

    const lowerKey = parsed.key.toLowerCase();
    const preserveCase =
      context.currentSection === "betterYou" && context.inReplacements;
    const key = preserveCase ? parsed.key : lowerKey;

    if (lowerKey === "replacements") {
      context.inReplacements = true;
    }

    const sectionConfig = context.rawConfig[context.currentSection];
    if (sectionConfig) {
      sectionConfig[key] = parsed.value;
    }
  }

  const result: Record<string, unknown> = {};

  for (const module of modules) {
    const raw = context.rawConfig[module.name] || {};

    let parsed: Record<string, unknown>;

    switch (module.name) {
      case "dice":
        parsed = parseDiceConfig(raw);
        break;
      case "interject":
        parsed = parseInterjectConfig(raw);
        break;
      case "paragraph":
        parsed = parseParagraphConfig(raw);
        break;
      case "redundancy":
        parsed = parseRedundancyConfig(raw);
        break;
      case "betterYou":
        parsed = parseBetterYouConfig(raw);
        break;
      default:
        parsed = raw;
    }

    try {
      result[module.name] = module.validateConfig(parsed);
    } catch (error) {
      console.error(
        `Failed to parse config for module ${module.name}:`,
        error
      );
      result[module.name] = module.validateConfig({});
    }
  }

  return result as T;
}
