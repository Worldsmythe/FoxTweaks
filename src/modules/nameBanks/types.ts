export type NameStrategy =
  | "pickOne"
  | "spaceJoin"
  | "concat"
  | "hyphenConcat"
  | "vowelSafeConcat";

export interface NameBank {
  readonly strategy: NameStrategy;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
}
