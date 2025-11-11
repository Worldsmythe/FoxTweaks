import type { Module, HookContext } from "../types";
import { escapeRegex } from "../utils/string";
import { booleanValidator, objectValidator } from "../utils/validation";

export interface BetterYouConfig {
  enable: boolean;
  replacements: Record<string, string>;
}

export const BetterYou: Module<BetterYouConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): BetterYouConfig {
    const rawReplacements = objectValidator<Record<string, unknown>>(raw, "replacements");
    const replacements: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawReplacements)) {
      if (typeof value === "string") {
        replacements[key] = value;
      }
    }

    return {
      enable: booleanValidator(raw, "enable"),
      replacements,
    };
  }

  function replaceOutsideQuotes(
    line: string,
    replacements: Record<string, string>
  ): string {
    const parts = line.split('"');

    for (let i = 0; i < parts.length; i += 2) {
      const part = parts[i];
      if (part !== undefined) {
        for (const [from, to] of Object.entries(replacements)) {
          const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, "g");
          parts[i] = part.replace(regex, to);
        }
      }
    }

    return parts.join('"');
  }

  function onInput(text: string, config: BetterYouConfig, context: HookContext): string {
    if (!config.enable || Object.keys(config.replacements).length === 0) {
      return text;
    }

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (!line.match(/^>\s*You\b/) && !line.match(/^>\s*"/)) {
        continue;
      }

      lines[i] = replaceOutsideQuotes(line, config.replacements);
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
  . you: . You
  ." you: ." You`,
    validateConfig,
    hooks: {
      onInput,
    },
  };
})();
