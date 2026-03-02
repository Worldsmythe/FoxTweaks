import { STRUCTURED_NAME_BANKS, generateNamesFromBank } from "./nameBanks";

export const NAME_BANKS: Record<string, string> = {};

export function parseNameBank(text: string): string[][] {
  const lines = text.split("\n");
  const columns: string[][] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const parts = trimmedLine.split(",").map((p) => p.trim()).filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      if (!columns[i]) {
        columns[i] = [];
      }
      const part = parts[i];
      if (part) {
        columns[i]?.push(part);
      }
    }
  }

  return columns;
}

export function generateName(columns: string[][]): string {
  if (columns.length === 0) {
    return "";
  }

  const selectedParts: string[] = [];

  for (const column of columns) {
    if (column && column.length > 0) {
      const randomPart = column[Math.floor(Math.random() * column.length)];
      if (randomPart) {
        selectedParts.push(randomPart);
      }
    }
  }

  return selectedParts.join(" ");
}

export function generateNames(columns: string[][], count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = generateName(columns);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function getNameBankFromCard(
  bankName: string,
  storyCards: StoryCard[]
): string[][] | undefined {
  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && (card.title === bankName || card.keys?.includes(bankName))) {
      if (card.entry) {
        return parseNameBank(card.entry);
      }
    }
  }
  return undefined;
}

export function getNamesFromNameBank(
  bankName: string,
  storyCards: StoryCard[],
  count: number
): string[] {
  const structuredBank = STRUCTURED_NAME_BANKS[bankName];
  if (structuredBank) {
    return generateNamesFromBank(structuredBank, count);
  }

  if (NAME_BANKS[bankName]) {
    const columns = parseNameBank(NAME_BANKS[bankName] ?? "");
    if (columns.length > 0) {
      return generateNames(columns, count);
    }
  }

  const cardColumns = getNameBankFromCard(bankName, storyCards);
  if (cardColumns && cardColumns.length > 0) {
    return generateNames(cardColumns, count);
  }

  const defaultBank = STRUCTURED_NAME_BANKS["default"];
  if (defaultBank) {
    return generateNamesFromBank(defaultBank, count);
  }

  return generateNames(parseNameBank(NAME_BANKS["default"] ?? ""), count);
}

