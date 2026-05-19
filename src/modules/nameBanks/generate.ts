import type { NameBank } from "./types";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const BRIDGE_CONSONANTS = ["n", "r", "s", "t", "v"] as const;
const BRIDGE_VOWELS = ["a", "e", "i", "o", "u"] as const;
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

    case "blend": {
      const colA = bank.columns[0];
      const colB = bank.columns[1];
      if (!colA || !colB || colA.length === 0 || colB.length === 0) return "";

      const nameA = pickRandom(colA);
      const nameB = pickRandom(colB);
      if (!nameA || !nameB) return "";

      const direction = Math.random() < 0.5;
      const first = direction ? nameA : nameB;
      const second = direction ? nameB : nameA;

      const maxSliceFirst = Math.min(first.length, 4);
      const sliceFirst = Math.floor(Math.random() * (maxSliceFirst - 1)) + 2;
      const maxSliceSecond = Math.min(second.length, 4);
      const sliceSecond = Math.floor(Math.random() * (maxSliceSecond - 1)) + 2;

      const part1 = first.slice(0, sliceFirst);
      const part2 = second.slice(second.length - sliceSecond);

      const lastChar = part1[part1.length - 1];
      const firstChar = part2[0];
      let bridge = "";

      if (lastChar && firstChar) {
        const lastIsVowel = isVowel(lastChar);
        const firstIsVowel = isVowel(firstChar);
        if (lastIsVowel && firstIsVowel) {
          bridge = pickRandom(BRIDGE_CONSONANTS) ?? "";
        } else if (!lastIsVowel && !firstIsVowel) {
          bridge = pickRandom(BRIDGE_VOWELS) ?? "";
        }
      }

      return part1 + bridge + part2;
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
