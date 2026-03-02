import type { NameBank } from "./types";
import { englishBanks } from "./data/english";

export type { NameBank, NameStrategy } from "./types";
export { generateFromBank, generateNamesFromBank } from "./generate";

/** Registry of all structured name banks, keyed by bank name. */
export const STRUCTURED_NAME_BANKS: Record<string, NameBank> = {
  ...englishBanks,
};
