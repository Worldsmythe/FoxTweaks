import type { NameBank } from "./types";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const MAX_VOWEL_RETRIES = 10;

function pickRandom(arr: ReadonlyArray<string>): string | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isVowel(char: string): boolean {
  return VOWELS.has(char.toLowerCase());
}

/** Generates a single name from a structured name bank based on its strategy. */
export function generateFromBank(bank: NameBank): string {
  switch (bank.strategy) {
    case "pickOne": {
      const allEntries: string[] = [];
      for (let i = 0; i < bank.columns.length; i++) {
        const col = bank.columns[i];
        if (col) {
          for (let j = 0; j < col.length; j++) {
            const entry = col[j];
            if (entry) allEntries.push(entry);
          }
        }
      }
      return pickRandom(allEntries) ?? "";
    }

    case "spaceJoin": {
      const parts: string[] = [];
      for (let i = 0; i < bank.columns.length; i++) {
        const col = bank.columns[i];
        if (col && col.length > 0) {
          const picked = pickRandom(col);
          if (picked) parts.push(picked);
        }
      }
      return parts.join(" ");
    }

    case "concat": {
      const parts: string[] = [];
      for (let i = 0; i < bank.columns.length; i++) {
        const col = bank.columns[i];
        if (col && col.length > 0) {
          const picked = pickRandom(col);
          if (picked) parts.push(picked);
        }
      }
      return parts.join("");
    }

    case "hyphenConcat": {
      const a = bank.columns[0] ? pickRandom(bank.columns[0]) : undefined;
      const b = bank.columns[1] ? pickRandom(bank.columns[1]) : undefined;
      if (a && b) return `${a}-${b}`;
      return (a ?? "") + (b ?? "");
    }

    case "vowelSafeConcat": {
      const parts: string[] = [];
      for (let i = 0; i < bank.columns.length; i++) {
        const col = bank.columns[i];
        if (!col || col.length === 0) continue;

        let picked = pickRandom(col);
        if (picked && parts.length > 0) {
          const prev = parts[parts.length - 1];
          if (prev) {
            const lastChar = prev[prev.length - 1];
            if (lastChar && isVowel(lastChar)) {
              for (let retry = 0; retry < MAX_VOWEL_RETRIES; retry++) {
                const firstChar = picked[0];
                if (!firstChar || !isVowel(firstChar)) break;
                picked = pickRandom(col);
                if (!picked) break;
              }
            }
          }
        }
        if (picked) parts.push(picked);
      }
      return parts.join("");
    }
  }
}

/** Generates multiple names from a structured name bank. */
export function generateNamesFromBank(
  bank: NameBank,
  count: number
): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = generateFromBank(bank);
    if (name) names.push(name);
  }
  return names;
}
