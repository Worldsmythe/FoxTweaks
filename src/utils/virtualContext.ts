export type SectionName =
  | "World Lore"
  | "Story Summary"
  | "Memories"
  | "Narrative Checklist"
  | "Recent Story"
  | "Author's Note";

export interface Section {
  readonly name: SectionName;
  readonly header: string;
  readonly body: string;
}

export interface VirtualContext {
  readonly preamble: string;
  readonly sections: ReadonlyMap<SectionName, Section>;
  readonly postamble: string;
  readonly worldLoreCards: readonly StoryCard[];
  readonly raw: string;
  readonly maxChars?: number;
}

export interface SerializeOptions {
  headerFormat: "plain" | "markdown";
  markdownLevel: string;
  authorsNoteFormat: "bracket" | "markdown";
  minRecentStoryPercent?: number;
  postambleHeader?: string;
}

export const SECTION_ORDER: readonly SectionName[] = [
  "World Lore",
  "Story Summary",
  "Memories",
  "Narrative Checklist",
  "Recent Story",
  "Author's Note",
];

const DEFAULT_HEADERS: Record<SectionName, string> = {
  "World Lore": "World Lore:",
  "Story Summary": "Story Summary:",
  "Memories": "Memories:",
  "Narrative Checklist": "Narrative Checklist:",
  "Recent Story": "Recent Story:",
  "Author's Note": "[Author's note:",
};

const SECTION_PATTERNS: Array<{ name: SectionName; pattern: RegExp }> = [
  { name: "World Lore", pattern: /^World Lore:?/im },
  { name: "Story Summary", pattern: /^Story Summary:?/im },
  { name: "Memories", pattern: /^Memories:?/im },
  { name: "Narrative Checklist", pattern: /^Narrative Checklist:?/im },
  { name: "Recent Story", pattern: /^Recent Story:?/im },
  { name: "Author's Note", pattern: /^\[Author'?s?\s+[Nn]ote:/im },
];

const BRACKET_AUTHORS_NOTE_PATTERN = /^\[Author'?s?\s+[Nn]ote:\s*([^\]]*)\]$/im;

interface ParsedSection {
  name: SectionName;
  header: string;
  startIndex: number;
  endIndex: number;
  body: string;
}

interface BracketAuthorsNoteResult {
  body: string;
  endIndex: number;
}

function extractBracketAuthorsNoteBody(text: string, startIndex: number): BracketAuthorsNoteResult | undefined {
  const remaining = text.slice(startIndex);
  const closeBracket = remaining.indexOf("]");
  if (closeBracket === -1) return undefined;

  const fullMatch = remaining.slice(0, closeBracket + 1);
  const bracketMatch = BRACKET_AUTHORS_NOTE_PATTERN.exec(fullMatch);
  if (bracketMatch) {
    return {
      body: bracketMatch[1]?.trim() ?? "",
      endIndex: startIndex + closeBracket + 1,
    };
  }
  return undefined;
}

interface FindSectionsResult {
  sections: ParsedSection[];
  authorsNoteEndIndex: number | null;
}

function findSections(text: string): FindSectionsResult {
  const found: Array<{ name: SectionName; header: string; startIndex: number }> = [];

  for (const { name, pattern } of SECTION_PATTERNS) {
    let match;
    const globalPattern = new RegExp(pattern.source, "gim");

    while ((match = globalPattern.exec(text)) !== null) {
      found.push({
        name,
        header: match[0],
        startIndex: match.index,
      });
    }
  }

  found.sort((a, b) => a.startIndex - b.startIndex);

  const sections: ParsedSection[] = [];
  let authorsNoteEndIndex: number | null = null;

  for (let i = 0; i < found.length; i++) {
    const current = found[i];
    if (!current) continue;

    const next = found[i + 1];
    const endIndex = next ? next.startIndex : text.length;

    let body: string;

    if (current.name === "Author's Note") {
      const bracketResult = extractBracketAuthorsNoteBody(text, current.startIndex);
      body = bracketResult?.body ?? "";
      if (bracketResult) {
        authorsNoteEndIndex = bracketResult.endIndex;
      }
    } else {
      const fullContent = text.slice(current.startIndex, endIndex);
      const headerEndIndex = fullContent.indexOf("\n");
      body = headerEndIndex === -1 ? "" : fullContent.slice(headerEndIndex + 1).trim();
    }

    sections.push({
      name: current.name,
      header: current.header,
      startIndex: current.startIndex,
      endIndex,
      body,
    });
  }

  return { sections, authorsNoteEndIndex };
}

function matchCardsToWorldLore(
  worldLoreBody: string,
  storyCards: StoryCard[]
): StoryCard[] {
  const matched: StoryCard[] = [];

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card?.entry && worldLoreBody.includes(card.entry)) {
      matched.push(card);
    }
  }

  return matched;
}

export function parseContext(
  text: string,
  storyCards: StoryCard[],
  maxChars?: number
): VirtualContext {
  const { sections: parsedSections, authorsNoteEndIndex } = findSections(text);

  const sectionMap = new Map<SectionName, Section>();
  let preamble = "";
  let postamble = "";

  if (parsedSections.length > 0 && parsedSections[0]) {
    preamble = text.slice(0, parsedSections[0].startIndex).trim();
  } else {
    preamble = text.trim();
  }

  if (authorsNoteEndIndex !== null && authorsNoteEndIndex < text.length) {
    postamble = text.slice(authorsNoteEndIndex).trim();
  }

  for (const parsed of parsedSections) {
    const existing = sectionMap.get(parsed.name);

    if (existing) {
      const concatenatedBody = existing.body
        ? existing.body + "\n\n" + parsed.body
        : parsed.body;

      sectionMap.set(parsed.name, {
        name: parsed.name,
        header: existing.header,
        body: concatenatedBody,
      });
    } else {
      sectionMap.set(parsed.name, {
        name: parsed.name,
        header: parsed.header,
        body: parsed.body,
      });
    }
  }

  const worldLoreSection = sectionMap.get("World Lore");
  const worldLoreCards = worldLoreSection
    ? matchCardsToWorldLore(worldLoreSection.body, storyCards)
    : [];

  return {
    preamble,
    sections: sectionMap,
    postamble,
    worldLoreCards,
    raw: text,
    maxChars,
  };
}

export function getSection(
  ctx: VirtualContext,
  name: SectionName
): Section | undefined {
  return ctx.sections.get(name);
}

function createSection(name: SectionName, body: string): Section {
  return {
    name,
    header: DEFAULT_HEADERS[name],
    body,
  };
}

function cloneWithNewSections(
  ctx: VirtualContext,
  sections: Map<SectionName, Section>
): VirtualContext {
  return {
    preamble: ctx.preamble,
    sections,
    postamble: ctx.postamble,
    worldLoreCards: ctx.worldLoreCards,
    raw: ctx.raw,
    maxChars: ctx.maxChars,
  };
}

export function setSection(
  ctx: VirtualContext,
  name: SectionName,
  body: string
): VirtualContext {
  const newSections = new Map(ctx.sections);
  const existing = ctx.sections.get(name);

  if (existing) {
    newSections.set(name, { ...existing, body });
  } else {
    newSections.set(name, createSection(name, body));
  }

  return cloneWithNewSections(ctx, newSections);
}

export function appendToSection(
  ctx: VirtualContext,
  name: SectionName,
  content: string
): VirtualContext {
  const existing = ctx.sections.get(name);
  const newBody = existing?.body
    ? existing.body + "\n\n" + content
    : content;

  return setSection(ctx, name, newBody);
}

export function prependToSection(
  ctx: VirtualContext,
  name: SectionName,
  content: string
): VirtualContext {
  const existing = ctx.sections.get(name);
  const newBody = existing?.body
    ? content + "\n\n" + existing.body
    : content;

  return setSection(ctx, name, newBody);
}

export function removeSection(
  ctx: VirtualContext,
  name: SectionName
): VirtualContext {
  const newSections = new Map(ctx.sections);
  newSections.delete(name);
  return cloneWithNewSections(ctx, newSections);
}

export function hasWorldLoreCard(ctx: VirtualContext, cardId: string): boolean {
  for (let i = 0; i < ctx.worldLoreCards.length; i++) {
    if (ctx.worldLoreCards[i]?.id === cardId) {
      return true;
    }
  }
  return false;
}

export function addWorldLoreCard(
  ctx: VirtualContext,
  card: StoryCard
): VirtualContext {
  if (!card.entry?.trim()) {
    return ctx;
  }

  if (hasWorldLoreCard(ctx, card.id)) {
    return ctx;
  }

  const newCards = [...ctx.worldLoreCards, card];
  const ctxWithCard: VirtualContext = {
    preamble: ctx.preamble,
    sections: ctx.sections,
    postamble: ctx.postamble,
    worldLoreCards: newCards,
    raw: ctx.raw,
    maxChars: ctx.maxChars,
  };

  return appendToSection(ctxWithCard, "World Lore", card.entry);
}

const SENTENCE_END_PATTERN = /[.!?](?:\s+(?=[A-Z])|\s*\n|\s*$)/g;

function countSentences(text: string): number {
  if (!text.trim()) return 0;
  const matches = text.match(SENTENCE_END_PATTERN);
  return matches ? matches.length : 0;
}

function findSentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [];
  let match;

  const pattern = new RegExp(SENTENCE_END_PATTERN.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length);
  }

  return boundaries;
}

export interface TruncateOptions {
  targetChars?: number;
  minSentences?: number;
  fromStart?: boolean;
}

export function truncateSection(
  ctx: VirtualContext,
  name: SectionName,
  options: TruncateOptions
): VirtualContext {
  const section = ctx.sections.get(name);
  if (!section) {
    return ctx;
  }

  const { targetChars, minSentences = 5, fromStart = true } = options;

  if (targetChars === undefined || section.body.length <= targetChars) {
    return ctx;
  }

  const boundaries = findSentenceBoundaries(section.body);
  const totalSentences = boundaries.length;

  if (totalSentences <= minSentences) {
    return ctx;
  }

  let newBody: string;

  if (fromStart) {
    const charsToRemove = section.body.length - targetChars;
    let cutIndex = 0;
    const maxRemovable = totalSentences - minSentences;

    for (let i = 0; i < boundaries.length && i < maxRemovable; i++) {
      const boundary = boundaries[i];
      if (boundary === undefined) continue;

      if (boundary >= charsToRemove) {
        cutIndex = boundary;
        break;
      }
      cutIndex = boundary;
    }

    newBody = cutIndex > 0 ? section.body.slice(cutIndex).trim() : section.body;
  } else {
    let cutIndex = section.body.length;
    const sentencesToKeep = Math.max(minSentences, boundaries.length);
    const targetBoundaryIndex = sentencesToKeep - 1;

    if (targetBoundaryIndex >= 0 && targetBoundaryIndex < boundaries.length) {
      const boundary = boundaries[targetBoundaryIndex];
      if (boundary !== undefined && boundary <= targetChars) {
        cutIndex = boundary;
      }
    }

    for (let i = boundaries.length - 1; i >= minSentences - 1; i--) {
      const boundary = boundaries[i];
      if (boundary !== undefined && boundary <= targetChars) {
        cutIndex = boundary;
        break;
      }
    }

    newBody = section.body.slice(0, cutIndex).trim();
  }

  return setSection(ctx, name, newBody);
}

function formatHeader(
  name: SectionName,
  originalHeader: string,
  options: SerializeOptions
): string {
  if (options.headerFormat === "plain") {
    if (name === "Author's Note") {
      return "[Author's note:";
    }
    return `${name}:`;
  }

  if (name === "Author's Note") {
    if (options.authorsNoteFormat === "bracket") {
      return "[Author's note:";
    }
    return `${options.markdownLevel}# Author's Note:`;
  }

  return `${options.markdownLevel} ${name}`;
}

function formatSectionContent(
  section: Section,
  options: SerializeOptions
): string {
  const header = formatHeader(section.name, section.header, options);

  if (section.name === "Author's Note") {
    if (options.headerFormat === "plain" || options.authorsNoteFormat === "bracket") {
      return `${header} ${section.body}]`;
    }
    return `${header}\n${section.body}`;
  }

  if (!section.body) {
    return header;
  }

  return `${header}\n${section.body}`;
}

export function serializeContext(
  ctx: VirtualContext,
  options: SerializeOptions = {
    headerFormat: "plain",
    markdownLevel: "##",
    authorsNoteFormat: "bracket",
  }
): string {
  const parts: string[] = [];

  if (ctx.preamble) {
    parts.push(ctx.preamble);
  }

  for (const sectionName of SECTION_ORDER) {
    const section = ctx.sections.get(sectionName);
    if (section) {
      parts.push(formatSectionContent(section, options));
    }
  }

  if (ctx.postamble) {
    const header = options.postambleHeader ?? "Continue From:";
    if (options.headerFormat === "markdown") {
      parts.push(`${options.markdownLevel} ${header}\n${ctx.postamble}`);
    } else {
      parts.push(`${header}\n${ctx.postamble}`);
    }
  }

  return parts.join("\n\n");
}

export function getContextLength(ctx: VirtualContext): number {
  return serializeContext(ctx).length;
}

export function setPostamble(ctx: VirtualContext, postamble: string): VirtualContext {
  return {
    preamble: ctx.preamble,
    sections: ctx.sections,
    postamble,
    worldLoreCards: ctx.worldLoreCards,
    raw: ctx.raw,
    maxChars: ctx.maxChars,
  };
}

export function appendToPostamble(ctx: VirtualContext, content: string): VirtualContext {
  const newPostamble = ctx.postamble
    ? ctx.postamble + "\n" + content
    : content;
  return setPostamble(ctx, newPostamble);
}

export function prependToPostamble(ctx: VirtualContext, content: string): VirtualContext {
  const newPostamble = ctx.postamble
    ? content + "\n" + ctx.postamble
    : content;
  return setPostamble(ctx, newPostamble);
}

export function setPreamble(ctx: VirtualContext, preamble: string): VirtualContext {
  return {
    preamble,
    sections: ctx.sections,
    postamble: ctx.postamble,
    worldLoreCards: ctx.worldLoreCards,
    raw: ctx.raw,
    maxChars: ctx.maxChars,
  };
}

export function appendToPreamble(ctx: VirtualContext, content: string): VirtualContext {
  const newPreamble = ctx.preamble
    ? ctx.preamble + "\n\n" + content
    : content;
  return setPreamble(ctx, newPreamble);
}
