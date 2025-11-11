import type { Module, HookParams, HookReturn, History, HookContext } from "../types";
import { getLastAction, isActionType } from "../utils/history";
import { booleanValidator, enumValidator } from "../utils/validation";

type FormattingType = "none" | "basic" | "empty-line" | "newline";

export interface ParagraphConfig {
  enable: boolean;
  formattingType: FormattingType;
  indentParagraphs: boolean;
}

export const Paragraph: Module<ParagraphConfig> = (() => {
  const FORMATTING_TYPES = ["none", "basic", "empty-line", "newline"] as const;

  function validateConfig(raw: Record<string, unknown>): ParagraphConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      formattingType: enumValidator(raw, "formattingType", FORMATTING_TYPES, "none"),
      indentParagraphs: booleanValidator(raw, "indentParagraphs"),
    };
  }

  function adjustNewlines(text: string, prevAction: History | null): string {
    if (!prevAction) return text;

    if (isActionType(prevAction, ["do", "say", "see"])) {
      return text;
    }

    const prevText = prevAction.text || prevAction.rawText || "";
    const endNewlines = Math.min(2, (prevText.match(/\n*$/)?.[0] || "").length);
    const startNewlines = Math.min(2, (text.match(/^\n*/)?.[0] || "").length);
    const totalNewlines = endNewlines + startNewlines;

    if (totalNewlines === 1) {
      return "\n" + text;
    }

    return text;
  }

  function applyIndentation(text: string, prevAction: History | null): string {
    if (!prevAction) return text;

    const isAfterDoSay = isActionType(prevAction, ["do", "say", "see"]);

    if (isAfterDoSay) {
      const lines = text.split("\n");
      return lines
        .map((line) => {
          const trimmed = line.trimStart();
          if (
            trimmed.startsWith(">") ||
            trimmed === "" ||
            line.startsWith("    ")
          ) {
            return line;
          }
          return "    " + line;
        })
        .join("\n");
    } else {
      return text.replace(/\n\n(\s*)(?=\S)(?!>)/g, "\n\n    ");
    }
  }

  function onContext(params: HookParams, config: ParagraphConfig, context: HookContext): HookReturn {
    const text = params.text.replace(/^    /gm, "");
    return { ...params, text };
  }

  function onOutput(params: HookParams, config: ParagraphConfig, context: HookContext): HookReturn {
    if (!config.enable || config.formattingType === "none") {
      return params;
    }

    let { text } = params;

    switch (config.formattingType) {
      case "basic":
        text = text.replace(/\s{2,}|\n/g, "\n\n");
        break;
      case "empty-line":
        text = text.replace(/(?<!,) (?=")|\s{2,}|\n/g, "\n\n");
        break;
      case "newline":
        text = text.replace(/\s{2,}|\n/g, "\n\n").replace(/(?<!,) (?=")/g, "\n");
        break;
    }

    const prevAction = getLastAction();
    text = adjustNewlines(text, prevAction);

    if (config.indentParagraphs) {
      text = applyIndentation(text, prevAction);
    }

    return { ...params, text };
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
    hooks: {
      onContext,
      onOutput,
    },
  };
})();
