import type { Module, ParsedConfigLine } from "./types";

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

function getIndentDepth(line: string): number {
  let spaces = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ") {
      spaces++;
    } else if (line[i] === "\t") {
      spaces += 2;
    } else {
      break;
    }
  }
  if (spaces === 0) return 0;
  if (spaces <= 2) return 1;
  return 2;
}

interface ParseContext {
  currentSection: string | null;
  currentModule: Module<unknown> | null;
  inReplacements: boolean;
  rawConfig: Record<string, Record<string, unknown>>;
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

  let currentNestedKey: string | null = null;
  let currentNestedObject: Record<string, unknown> | null = null;
  let currentSubKey: string | null = null;
  let currentSubObject: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("---") && trimmed.endsWith("---")) {
      const sectionName = trimmed.replace(/---/g, "").trim().toLowerCase();

      context.currentModule = null;
      context.inReplacements = false;
      currentNestedKey = null;
      currentNestedObject = null;
      currentSubKey = null;
      currentSubObject = null;

      const normalizedSectionName = sectionName.replace(/\s+/g, "");
      for (const module of modules) {
        if (
          normalizedSectionName === module.name.toLowerCase() ||
          (module.name === "redundancy" && normalizedSectionName === "dedup")
        ) {
          context.currentSection = module.name;
          context.currentModule = module;
          break;
        }
      }

      continue;
    }

    const parsed = parseConfigLine(line);

    if (!parsed.isValid && trimmed && !trimmed.startsWith("#")) {
      continue;
    }
    if (!parsed.isValid) continue;

    if (!context.currentSection || !context.currentModule) continue;

    const sectionConfig = context.rawConfig[context.currentSection];
    if (!sectionConfig) continue;

    const indentDepth = getIndentDepth(line);
    const lowerKey = parsed.key.toLowerCase();

    if (indentDepth === 0) {
      currentNestedKey = null;
      currentNestedObject = null;
      currentSubKey = null;
      currentSubObject = null;

      if (parsed.value === "" || parsed.value.trim() === "") {
        currentNestedKey = lowerKey;
        currentNestedObject = {};
        sectionConfig[lowerKey] = currentNestedObject;
      } else {
        sectionConfig[lowerKey] = parsed.value;
      }
    } else if (indentDepth === 1) {
      currentSubKey = null;
      currentSubObject = null;

      if (currentNestedObject && currentNestedKey) {
        if (parsed.value === "" || parsed.value.trim() === "") {
          currentSubKey = lowerKey;
          currentSubObject = {};
          currentNestedObject[lowerKey] = currentSubObject;
        } else {
          const preserveCase = context.currentSection === "betterYou" ||
            (context.currentSection === "dice" && currentNestedKey === "outcomelabels");
          const nestedKey = preserveCase ? parsed.key : lowerKey;
          currentNestedObject[nestedKey] = parsed.value;
        }
      }
    } else if (indentDepth >= 2) {
      if (currentSubObject && currentSubKey) {
        currentSubObject[lowerKey] = parsed.value;
      }
    }
  }

  const result: Record<string, unknown> = {};

  for (const module of modules) {
    const raw = context.rawConfig[module.name] || {};

    try {
      result[module.name] = module.validateConfig(raw);
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
