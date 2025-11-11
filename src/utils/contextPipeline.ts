import type { ContextSection } from "../types";

const SECTION_PATTERNS = [
  { name: "World Lore", pattern: /^(#{1,4}\s+)?World Lore:?/im },
  { name: "Story Summary", pattern: /^(#{1,4}\s+)?Story Summary:?/im },
  { name: "Memories", pattern: /^(#{1,4}\s+)?Memories:?/im },
  { name: "Narrative Checklist", pattern: /^(#{1,4}\s+)?Narrative Checklist:?/im },
  { name: "Recent Story", pattern: /^(#{1,4}\s+)?Recent Story:?/im },
  { name: "Author's Note", pattern: /^(#{1,4}\s+)?(\[?)Author'?s?\s+[Nn]ote:?/im },
];

export function parseContextSections(text: string): ContextSection[] {
  const sections: ContextSection[] = [];

  for (const { name, pattern } of SECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      sections.push({
        name,
        header: match[0],
        startIndex: match.index,
        endIndex: -1,
        content: "",
      });
    }
  }

  sections.sort((a, b) => a.startIndex - b.startIndex);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;

    const nextSection = sections[i + 1];

    section.endIndex = nextSection ? nextSection.startIndex : text.length;
    section.content = text.slice(section.startIndex, section.endIndex);
  }

  return sections;
}

function findMatchingBracket(text: string, startIndex: number): number {
  let depth = 0;
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === "[") {
      depth++;
    } else if (text[i] === "]") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

export function replaceHeaders(text: string, headerMap: Record<string, string>): string {
  let result = text;

  for (const [oldHeader, newHeader] of Object.entries(headerMap)) {
    if (oldHeader === "[Author's note:") {
      const pattern = /^\[Author's note:/gim;
      let match;

      while ((match = pattern.exec(result)) !== null) {
        const startIndex = match.index;
        const closingBracketIndex = findMatchingBracket(result, startIndex);

        if (closingBracketIndex !== -1) {
          const innerContent = result.slice(startIndex + match[0].length, closingBracketIndex).trim();
          const replacement = `${newHeader}\n${innerContent}`;

          result = result.slice(0, startIndex) + replacement + result.slice(closingBracketIndex + 1);
          pattern.lastIndex = startIndex + replacement.length;
        }
      }
    } else {
      const pattern = new RegExp(`^${escapeRegex(oldHeader)}`, "gim");
      result = result.replace(pattern, newHeader);
    }
  }

  return result;
}

export function injectSection(
  text: string,
  sectionName: string,
  content: string,
  options?: { afterSection?: string; beforeSection?: string }
): string {
  const sections = parseContextSections(text);

  const existingSection = sections.find(s => s.name === sectionName);
  if (existingSection) {
    const before = text.slice(0, existingSection.startIndex);
    const after = text.slice(existingSection.endIndex);
    return before + content + after;
  }

  if (options?.beforeSection) {
    const targetSection = sections.find(s => s.name === options.beforeSection);
    if (targetSection) {
      const before = text.slice(0, targetSection.startIndex);
      const after = text.slice(targetSection.startIndex);
      return before + content + "\n\n" + after;
    }
    return text;
  }

  if (options?.afterSection) {
    const targetSection = sections.find(s => s.name === options.afterSection);
    if (targetSection) {
      const before = text.slice(0, targetSection.endIndex);
      const after = text.slice(targetSection.endIndex);
      return before + "\n\n" + content + after;
    }
  }

  return text + "\n\n" + content;
}

export function truncateSection(
  text: string,
  sectionName: string,
  minChars: number
): string {
  const sections = parseContextSections(text);
  const section = sections.find(s => s.name === sectionName);

  if (!section || section.content.length <= minChars) {
    return text;
  }

  const headerMatch = section.content.match(/^[^\n]+\n/);
  const header = headerMatch ? headerMatch[0] : "";
  const body = section.content.slice(header.length);

  if (body.length <= minChars) {
    return text;
  }

  const truncated = body.slice(body.length - minChars);
  const newContent = header + truncated;

  const before = text.slice(0, section.startIndex);
  const after = text.slice(section.endIndex);

  return before + newContent + after;
}

export function getSectionContent(text: string, sectionName: string): string | null {
  const sections = parseContextSections(text);
  const section = sections.find(s => s.name === sectionName);
  return section ? section.content : null;
}

export function removeSectionHeader(sectionContent: string): string {
  const headerMatch = sectionContent.match(/^[^\n]+\n/);
  return headerMatch ? sectionContent.slice(headerMatch[0].length) : sectionContent;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
