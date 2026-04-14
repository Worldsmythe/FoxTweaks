import type { Module, VirtualContext, HookContext } from "../types";
import { booleanValidator, stringValidator } from "../utils/validation";
import { prependToSection } from "../utils/virtualContext";
import { getNamesFromNameBank } from "./nameBank";

function patternToRegex(pattern: string): RegExp {
  if (pattern.startsWith("*") && pattern.endsWith("*")) {
    const inner = escapeRegex(pattern.slice(1, -1));
    return new RegExp(`\\b\\w*${inner}\\w*\\b`, "g");
  }
  if (pattern.startsWith("*")) {
    const suffix = escapeRegex(pattern.slice(1));
    return new RegExp(`\\b\\w*${suffix}\\b`, "g");
  }
  if (pattern.endsWith("*")) {
    const prefix = escapeRegex(pattern.slice(0, -1));
    return new RegExp(`\\b${prefix}\\w*\\b`, "g");
  }
  const exact = escapeRegex(pattern);
  return new RegExp(`\\b${exact}\\b`, "g");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSegment(name: string, segments: number): string {
  if (segments === 0) return name;
  const parts = name.split(" ");
  if (segments > 0) {
    const idx = segments - 1;
    return idx < parts.length ? (parts[idx] ?? name) : name;
  }
  const idx = parts.length + segments;
  return idx >= 0 ? (parts[idx] ?? name) : name;
}

export interface NameEntry {
  prefix: string;
  count: number;
  id: string;
}

export interface ReplacementGroup {
  patterns: string[];
  bankId: string;
  segments: number;
}

export interface RandomNamesConfig {
  enable: boolean;
  sectionHeader: string;
  names: NameEntry[];
  replacements: ReplacementGroup[];
}

function parseNameEntry(raw: unknown): NameEntry | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;

  const obj = raw as Record<string, unknown>;
  const prefix = typeof obj["prefix"] === "string" ? obj["prefix"] : undefined;
  const id = typeof obj["id"] === "string" ? obj["id"] : undefined;
  const count =
    typeof obj["count"] === "number" && obj["count"] >= 1
      ? Math.floor(obj["count"])
      : undefined;

  if (!prefix || !id || !count) return undefined;
  return { prefix, count, id };
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseNamesFromNestedObject(obj: Record<string, unknown>): NameEntry[] {
  const entries: NameEntry[] = [];

  for (const key of Object.keys(obj)) {
    const group = obj[key];
    if (typeof group !== "object" || group === null || Array.isArray(group)) {
      continue;
    }

    const groupObj = group as Record<string, unknown>;
    const id = typeof groupObj["id"] === "string" ? groupObj["id"] : undefined;
    if (!id) continue;

    let count = 3;
    if (typeof groupObj["count"] === "string") {
      const parsed = parseInt(groupObj["count"], 10);
      if (!Number.isNaN(parsed) && parsed >= 1) count = parsed;
    } else if (typeof groupObj["count"] === "number" && groupObj["count"] >= 1) {
      count = Math.floor(groupObj["count"]);
    }

    entries.push({ prefix: titleCase(key), count, id });
  }

  return entries;
}

function parseNamesConfig(value: unknown): NameEntry[] {
  if (Array.isArray(value)) {
    const entries: NameEntry[] = [];
    for (let i = 0; i < value.length; i++) {
      const entry = parseNameEntry(value[i]);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  if (typeof value === "object" && value !== null) {
    return parseNamesFromNestedObject(value as Record<string, unknown>);
  }

  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parseNamesConfig(parsed);
      }
    } catch {
      return [];
    }
  }

  return [];
}

export const RandomNames: Module<RandomNamesConfig> = (() => {
  function parseReplacements(value: unknown): ReplacementGroup[] {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [];
    }

    const groups: ReplacementGroup[] = [];
    const obj = value as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      const group = obj[key];
      if (typeof group !== "object" || group === null || Array.isArray(group)) {
        continue;
      }

      const groupObj = group as Record<string, unknown>;
      const rawNames = typeof groupObj["replacenames"] === "string"
        ? groupObj["replacenames"]
        : "";
      const bankId = typeof groupObj["replacefrom"] === "string"
        ? groupObj["replacefrom"]
        : "";

      if (!rawNames || !bankId) continue;

      const patterns = rawNames.split(",").map((s: string) => s.trim()).filter(Boolean);
      if (patterns.length === 0) continue;

      let segments = 0;
      if (typeof groupObj["segments"] === "string") {
        segments = parseInt(groupObj["segments"], 10);
        if (Number.isNaN(segments)) segments = 0;
      } else if (typeof groupObj["segments"] === "number") {
        segments = groupObj["segments"];
      }

      groups.push({ patterns, bankId, segments });
    }

    return groups;
  }

  function validateConfig(raw: Record<string, unknown>): RandomNamesConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      sectionHeader: stringValidator(raw, "sectionheader", "Random Names"),
      names: parseNamesConfig(raw["names"]),
      replacements: parseReplacements(raw["replacements"]),
    };
  }

  function formatNames(
    groups: ReadonlyArray<{ prefix: string; names: string[] }>,
    header: string
  ): string {
    const lines: string[] = [header + ":"];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group && group.names.length > 0) {
        lines.push(group.prefix + ": " + group.names.join(", "));
      }
    }
    return lines.join("\n");
  }

  function onContext(
    ctx: VirtualContext,
    config: RandomNamesConfig,
    context: HookContext
  ): VirtualContext {
    if (!config.enable || config.names.length === 0) {
      return ctx;
    }

    const groups: Array<{ prefix: string; names: string[] }> = [];

    for (let i = 0; i < config.names.length; i++) {
      const entry = config.names[i];
      if (!entry) continue;

      const names = getNamesFromNameBank(
        entry.id,
        context.storyCards,
        entry.count
      );

      if (names.length > 0) {
        groups.push({ prefix: entry.prefix, names });
      }
    }

    if (groups.length === 0) {
      return ctx;
    }

    const formatted = formatNames(groups, config.sectionHeader);
    let content = "\n\n" + formatted + "\n";

    if (config.replacements.length > 0) {
      content += "\nWhen introducing new characters, use names from the provided name lists rather than common fantasy names.\n";
    }

    return prependToSection(ctx, "Author's Note", content);
  }

  function onOutput(
    text: string,
    config: RandomNamesConfig,
    context: HookContext
  ): string {
    if (!config.enable || config.replacements.length === 0) {
      return text;
    }

    let result = text;
    const replacementCache = new Map<string, string>();

    for (let i = 0; i < config.replacements.length; i++) {
      const group = config.replacements[i];
      if (!group) continue;

      for (let j = 0; j < group.patterns.length; j++) {
        const pattern = group.patterns[j];
        if (!pattern) continue;

        const regex = patternToRegex(pattern);
        result = result.replace(regex, (match) => {
          const cached = replacementCache.get(match);
          if (cached) return cached;

          const names = getNamesFromNameBank(
            group.bankId,
            context.storyCards,
            1
          );
          const generated = names[0] ?? "";
          if (!generated) return match;
          const replacement = extractSegment(generated, group.segments);
          replacementCache.set(match, replacement);
          return replacement;
        });
      }
    }

    return result;
  }

  return {
    name: "randomNames",
    configSection: `--- Random Names ---
Enable: true
SectionHeader: Random Names
Names:
  English Masculine:
    Count: 3
    Id: englishMasculine
  English Feminine:
    Count: 3
    Id: englishFeminine
# Replace tropey names in AI output with generated names:
# Replacements:
#   Group1:
#     ReplaceNames: Elara, Lyra, Kael*
#     ReplaceFrom: englishFeminine
#     Segments: 1
#   Group2:
#     ReplaceNames: Voss, Vance, Henderson
#     ReplaceFrom: englishMasculine
#     Segments: -1`,
    validateConfig,
    hooks: {
      onContext,
      onOutput,
    },
  };
})();
