import type { Module, HookContext } from "../types";
import { booleanValidator, stringValidator } from "../utils/validation";
import { replaceHeaders } from "../utils/contextPipeline";

export interface MarkdownHeadersConfig {
  enable: boolean;
  headerLevel: string;
}

export const MarkdownHeaders: Module<MarkdownHeadersConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): MarkdownHeadersConfig {
    return {
      enable: booleanValidator(raw, "enable", true),
      headerLevel: stringValidator(raw, "headerlevel", "##"),
    };
  }

  function onReformatContext(
    text: string,
    config: MarkdownHeadersConfig,
    context: HookContext
  ): string {
    if (!config.enable) {
      return text;
    }

    const headerMap: Record<string, string> = {
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
    hooks: {
      onReformatContext,
    },
  };
})();
