import type { Module } from "../types";
import { booleanValidator, stringValidator, numberValidator } from "../utils/validation";

export interface ContextConfig {
  enable: boolean;
  headerFormat: "plain" | "markdown";
  markdownLevel: string;
  authorsNoteFormat: "bracket" | "markdown";
  minRecentStoryPercent: number;
}

export const Context: Module<ContextConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): ContextConfig {
    const headerFormat = stringValidator(raw, "headerformat", "plain");
    const authorsNoteFormat = stringValidator(raw, "authorsnoteformat", "bracket");

    return {
      enable: booleanValidator(raw, "enable"),
      headerFormat: headerFormat === "markdown" ? "markdown" : "plain",
      markdownLevel: stringValidator(raw, "markdownlevel", "##"),
      authorsNoteFormat: authorsNoteFormat === "markdown" ? "markdown" : "bracket",
      minRecentStoryPercent: numberValidator(
        raw,
        "minrecentstory",
        { min: 0, max: 100, integer: true },
        30
      ),
    };
  }

  function migrateConfigSection(sectionText: string): string {
    return sectionText;
  }

  return {
    name: "context",
    configSection: `--- Context ---
Enable: false  # Enable custom context formatting
HeaderFormat: plain  # plain or markdown
MarkdownLevel: ##  # Header level for markdown mode
AuthorsNoteFormat: bracket  # bracket or markdown
MinRecentStory: 30  # Minimum % of context for Recent Story`,
    validateConfig,
    hooks: {},
    migrateConfigSection,
  };
})();

export function migrateMarkdownHeadersToContext(configText: string): string {
  const mdHeadersMatch = configText.match(/---\s*Markdown\s+Headers\s*---/i);
  if (!mdHeadersMatch) {
    return configText;
  }

  const contextMatch = configText.match(/---\s*Context\s*---/i);
  if (contextMatch) {
    return configText.replace(/---\s*Markdown\s+Headers\s*---[^-]*(?=---|$)/i, "");
  }

  const mdHeadersStart = configText.indexOf(mdHeadersMatch[0]);
  const nextSectionMatch = configText.slice(mdHeadersStart + mdHeadersMatch[0].length).match(/\n---\s+/);
  const mdHeadersEnd = nextSectionMatch
    ? mdHeadersStart + mdHeadersMatch[0].length + nextSectionMatch.index!
    : configText.length;

  const mdHeadersSection = configText.slice(mdHeadersStart, mdHeadersEnd);

  const enableMatch = mdHeadersSection.match(/Enable:\s*(\S+)/i);
  const enabled = enableMatch ? enableMatch[1]?.toLowerCase() === "true" : false;

  const headerLevelMatch = mdHeadersSection.match(/HeaderLevel:\s*(\S+)/i);
  const headerLevel = headerLevelMatch ? headerLevelMatch[1] : "##";

  const newContextSection = `--- Context ---
Enable: ${enabled}  # Enable custom context formatting
HeaderFormat: ${enabled ? "markdown" : "plain"}  # plain or markdown
MarkdownLevel: ${headerLevel}  # Header level for markdown mode
AuthorsNoteFormat: ${enabled ? "markdown" : "bracket"}  # bracket or markdown
MinRecentStory: 30  # Minimum % of context for Recent Story`;

  const beforeMdHeaders = configText.slice(0, mdHeadersStart);
  const afterMdHeaders = configText.slice(mdHeadersEnd);

  return beforeMdHeaders + newContextSection + afterMdHeaders;
}
