import type { Module, VirtualContext } from "../types";
import { booleanValidator } from "../utils/validation";
import {
  getSection,
  setSection,
  appendToSection,
  appendToPreamble,
  prependToPostamble,
  type SectionName,
} from "../utils/virtualContext";

export interface SectionInjectionConfig {
  enable: boolean;
}

const INJECT_PATTERN = /<inject\s+section="([^"]+)"\s*\/?>/i;

const VALID_INJECTION_TARGETS = new Set([
  "preamble",
  "World Lore",
  "Story Summary",
  "Memories",
  "Narrative Checklist",
  "Recent Story",
  "Author's Note",
  "postamble",
]);

type InjectionTarget = "preamble" | SectionName | "postamble";

interface InjectionInfo {
  target: InjectionTarget;
  cleanedEntry: string;
}

export function parseInjectionMarker(entry: string): InjectionInfo | undefined {
  const match = INJECT_PATTERN.exec(entry);
  if (!match || !match[1]) return undefined;

  const target = match[1].trim();
  if (!VALID_INJECTION_TARGETS.has(target)) return undefined;

  const cleanedEntry = entry.replace(INJECT_PATTERN, "").trim();
  return { target: target as InjectionTarget, cleanedEntry };
}

export function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

function injectToTarget(
  ctx: VirtualContext,
  target: InjectionTarget,
  content: string
): VirtualContext {
  if (!content.trim()) return ctx;

  switch (target) {
    case "preamble":
      return appendToPreamble(ctx, content);
    case "postamble":
      return prependToPostamble(ctx, content);
    default:
      return appendToSection(ctx, target, content);
  }
}

export const SectionInjection: Module<SectionInjectionConfig> = (() => {
  function validateConfig(
    raw: Record<string, unknown>
  ): SectionInjectionConfig {
    return {
      enable: booleanValidator(raw, "enable", true),
    };
  }

  function onContext(
    ctx: VirtualContext,
    config: SectionInjectionConfig
  ): VirtualContext {
    if (!config.enable) {
      return ctx;
    }

    const worldLoreSection = getSection(ctx, "World Lore");
    if (!worldLoreSection) {
      return ctx;
    }

    let currentCtx = ctx;
    let worldLoreBody = worldLoreSection.body;

    for (let i = 0; i < ctx.worldLoreCards.length; i++) {
      const card = ctx.worldLoreCards[i];
      if (!card?.entry) continue;

      const injectionInfo = parseInjectionMarker(card.entry);
      if (!injectionInfo || injectionInfo.target === "World Lore") continue;

      const cleanedEntry = stripWikilinks(injectionInfo.cleanedEntry);
      if (!cleanedEntry.trim()) continue;

      if (worldLoreBody.includes(card.entry)) {
        worldLoreBody = worldLoreBody.replace(card.entry, "").trim();
        worldLoreBody = worldLoreBody.replace(/\n{3,}/g, "\n\n");
      }

      currentCtx = setSection(currentCtx, "World Lore", worldLoreBody);
      currentCtx = injectToTarget(currentCtx, injectionInfo.target, cleanedEntry);

      worldLoreBody = getSection(currentCtx, "World Lore")?.body ?? worldLoreBody;
    }

    return currentCtx;
  }

  return {
    name: "sectionInjection",
    configSection: `--- Section Injection ---
Enable: true  # Process injection markers in World Lore cards`,
    validateConfig,
    hooks: {
      onContext,
    },
  };
})();
