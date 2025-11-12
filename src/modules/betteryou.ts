import type { Module, HookContext } from "../types";
import { escapeRegex } from "../utils/string";
import { booleanValidator, objectValidator } from "../utils/validation";

export interface BetterYouConfig {
  enable: boolean;
  replacements: Record<string, string>;
  patterns: Record<string, string>;
}

export const BetterYou: Module<BetterYouConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): BetterYouConfig {
    const rawReplacements = objectValidator<Record<string, unknown>>(
      raw,
      "replacements",
      {}
    );
    const replacements: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawReplacements)) {
      if (typeof value === "string") {
        replacements[key] = value;
      }
    }

    const rawPatterns = objectValidator<Record<string, unknown>>(
      raw,
      "patterns",
      {}
    );
    const patterns: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawPatterns)) {
      if (typeof value === "string") {
        patterns[key] = value;
      }
    }

    return {
      enable: booleanValidator(raw, "enable"),
      replacements,
      patterns,
    };
  }

  function applyPatterns(
    line: string,
    patterns: Record<string, string>
  ): string {
    let result = line;
    for (const [from, to] of Object.entries(patterns)) {
      const regex = new RegExp(escapeRegex(from), "g");
      result = result.replace(regex, to);
    }
    return result;
  }

  function replaceOutsideQuotes(
    line: string,
    replacements: Record<string, string>
  ): string {
    const parts = line.split('"');

    for (let i = 0; i < parts.length; i += 2) {
      let part = parts[i];
      if (part) {
        for (const [from, to] of Object.entries(replacements)) {
          const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, "g");
          part = part.replace(regex, to);
        }
        parts[i] = part;
      }
    }

    return parts.join('"');
  }

  function onInput(
    text: string,
    config: BetterYouConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    if (
      Object.keys(config.replacements).length === 0 &&
      Object.keys(config.patterns).length === 0
    ) {
      return text;
    }

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (!line.match(/^>\s*You\b/) && !line.match(/^>\s*"/)) {
        continue;
      }

      let processedLine = line;

      if (Object.keys(config.patterns).length > 0) {
        processedLine = applyPatterns(processedLine, config.patterns);
      }

      if (Object.keys(config.replacements).length > 0) {
        processedLine = replaceOutsideQuotes(
          processedLine,
          config.replacements
        );
      }

      lines[i] = processedLine;
    }

    return lines.join("\n");
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
    hooks: {
      onInput,
    },
  };
})();
