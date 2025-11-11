const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ["‹", "›"],
  ["«", "»"],
  ["「", "」"],
  ["『", "』"],
];

/**
 * Splits text into sentences, respecting quoted dialogue
 * @param text - The text to split
 * @returns Array of sentences
 */
export function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let currentSentence = "";
  let inQuote = false;
  let expectedClosing = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!char) continue;
    currentSentence += char;

    if (!inQuote) {
      const pair = QUOTE_PAIRS.find((p) => p[0] === char);
      if (pair && pair[1]) {
        inQuote = true;
        expectedClosing = pair[1];
      }
    } else if (char === expectedClosing) {
      inQuote = false;
      expectedClosing = "";
    }

    if (!inQuote && /[.!?。！？]/.test(char)) {
      const isCJK = /[。！？]/.test(char);
      const nextChar = i + 1 < text.length ? text[i + 1] : undefined;

      if (isCJK || !nextChar || /\s/.test(nextChar)) {
        sentences.push(currentSentence.trim());
        currentSentence = "";
      }
    }
  }

  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  return sentences.filter((s) => s.length > 0);
}

/**
 * Calculates the Levenshtein distance between two strings
 * @param str1 - First string
 * @param str2 - Second string
 * @returns The edit distance between the strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    const row0 = matrix[0];
    if (row0) {
      row0[j] = j;
    }
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      const currRow = matrix[i];
      const prevRow = matrix[i - 1];
      const currCell = matrix[i]?.[j - 1];
      const prevCell = matrix[i - 1]?.[j];
      const diagCell = matrix[i - 1]?.[j - 1];

      if (
        currRow &&
        prevRow !== undefined &&
        currCell !== undefined &&
        prevCell !== undefined &&
        diagCell !== undefined
      ) {
        currRow[j] = Math.min(prevCell + 1, currCell + 1, diagCell + cost);
      }
    }
  }

  return matrix[len1]?.[len2] ?? 0;
}

/**
 * Calculates similarity percentage between two strings
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity as a percentage (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(str1, str2);
  return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Calculates similarity with special handling for continuation patterns
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity as a percentage (0-100)
 */
export function calculateSimilarityWithContinuation(
  str1: string,
  str2: string
): number {
  const normalSimilarity = calculateSimilarity(str1, str2);

  const lengthRatio =
    Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
  if (lengthRatio > 0.7) {
    return normalSimilarity;
  }

  const shorter = str1.length < str2.length ? str1 : str2;
  const longer = str1.length < str2.length ? str2 : str1;

  const normalizeForComparison = (text: string): string => {
    return text
      .replace(/["‹›«»「」『』]/g, "")
      .replace(/[.!?,]+\s*$/, "")
      .trim();
  };

  const shorterCore = normalizeForComparison(shorter);
  const longerCore = normalizeForComparison(longer);

  if (longerCore.toLowerCase().includes(shorterCore.toLowerCase())) {
    const matchRatio = shorterCore.length / shorter.length;
    return Math.max(normalSimilarity, 70 + matchRatio * 20);
  }

  const prefixLength = Math.min(longer.length, shorter.length + 20);
  const prefix = longer.substring(0, prefixLength);
  const prefixSimilarity = calculateSimilarity(shorter, prefix);

  return Math.max(normalSimilarity, prefixSimilarity);
}

/**
 * Finds overlapping sentences between two sentence arrays
 * @param sentences1 - First array of sentences
 * @param sentences2 - Second array of sentences
 * @param similarityThreshold - Minimum similarity percentage (default: 70)
 * @returns Number of overlapping sentences found
 */
export function findSentenceOverlap(
  sentences1: string[],
  sentences2: string[],
  similarityThreshold = 70
): number {
  const maxToCheck = Math.min(3, sentences1.length, sentences2.length);

  let bestOverlapCount = 0;
  let bestTotalSimilarity = 0;

  for (let overlapSize = maxToCheck; overlapSize >= 1; overlapSize--) {
    const lastSentences1 = sentences1.slice(-overlapSize);
    const firstSentences2 = sentences2.slice(0, overlapSize);

    let totalSimilarity = 0;
    let allAboveThreshold = true;

    for (let i = 0; i < overlapSize; i++) {
      const sent1 = lastSentences1[i];
      const sent2 = firstSentences2[i];
      if (!sent1 || !sent2) {
        allAboveThreshold = false;
        break;
      }

      const similarity = calculateSimilarityWithContinuation(
        sent1.toLowerCase(),
        sent2.toLowerCase()
      );

      totalSimilarity += similarity;

      if (similarity < similarityThreshold) {
        allAboveThreshold = false;
        break;
      }
    }

    if (allAboveThreshold && totalSimilarity > bestTotalSimilarity) {
      bestOverlapCount = overlapSize;
      bestTotalSimilarity = totalSimilarity;
    }
  }

  return bestOverlapCount;
}

export function checkAndMerge(
  previousMessage: string,
  currentMessage: string,
  similarityThreshold = 70
): MergeResult {
  if (!previousMessage || !currentMessage) {
    return { shouldMerge: false };
  }

  const prevTrimmed = previousMessage.trim();
  const currTrimmed = currentMessage.trim();

  const overallSimilarity = calculateSimilarity(prevTrimmed, currTrimmed);

  if (overallSimilarity > 90) {
    const merged =
      prevTrimmed.length >= currTrimmed.length ? prevTrimmed : currTrimmed;
    return {
      shouldMerge: true,
      mergedContent: merged,
      reason: "full-duplicate",
    };
  }

  const sentences1 = splitIntoSentences(prevTrimmed);
  const sentences2 = splitIntoSentences(currTrimmed);

  const overlapCount = findSentenceOverlap(
    sentences1,
    sentences2,
    similarityThreshold
  );

  if (overlapCount > 0) {
    const remainingSentences1 = sentences1.slice(0, -overlapCount);

    if (remainingSentences1.length === 0) {
      return {
        shouldMerge: true,
        mergedContent: currTrimmed,
        reason: "sentence-overlap",
      };
    }

    const part1 = remainingSentences1.join(" ");
    const hasCJK = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(
      part1 + currTrimmed
    );
    const separator = hasCJK ? "" : " ";
    const merged = part1 + separator + currTrimmed;

    return {
      shouldMerge: true,
      mergedContent: merged.trim(),
      reason: "sentence-overlap",
    };
  }

  return { shouldMerge: false };
}

interface MergeResult {
  shouldMerge: boolean;
  mergedContent?: string;
  reason?: string;
}
