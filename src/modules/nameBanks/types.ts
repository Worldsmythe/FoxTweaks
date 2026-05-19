export type NameStrategy =
  | "pickOne"
  | "spaceJoin"
  | "concat"
  | "hyphenConcat"
  | "vowelSafeConcat"
  | "blend";

export interface NameBank {
  readonly strategy: NameStrategy;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
}
