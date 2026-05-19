import { describe, test, expect } from "bun:test";
import { generateFromBank, generateNamesFromBank } from "./generate";
import type { NameBank } from "./types";

describe("generateFromBank", () => {
  describe("pickOne strategy", () => {
    test("picks one entry from a single column", () => {
      const bank: NameBank = {
        strategy: "pickOne",
        columns: [["Alice", "Bob", "Charlie"]],
      };
      const name = generateFromBank(bank);
      expect(["Alice", "Bob", "Charlie"]).toContain(name);
    });

    test("picks one entry from any of multiple columns", () => {
      const bank: NameBank = {
        strategy: "pickOne",
        columns: [
          ["Alice", "Bob"],
          ["Xavier", "Yvonne"],
        ],
      };
      const name = generateFromBank(bank);
      expect(["Alice", "Bob", "Xavier", "Yvonne"]).toContain(name);
    });

    test("returns empty string for empty columns", () => {
      const bank: NameBank = { strategy: "pickOne", columns: [] };
      expect(generateFromBank(bank)).toBe("");
    });
  });

  describe("spaceJoin strategy", () => {
    test("joins parts from each column with space", () => {
      const bank: NameBank = {
        strategy: "spaceJoin",
        columns: [["Khab"], ["Khedar"]],
      };
      expect(generateFromBank(bank)).toBe("Khab Khedar");
    });

    test("picks one from each column", () => {
      const bank: NameBank = {
        strategy: "spaceJoin",
        columns: [
          ["Khab", "Khad"],
          ["Khedar", "Kharuk"],
        ],
      };
      const name = generateFromBank(bank);
      const parts = name.split(" ");
      expect(parts.length).toBe(2);
      const [first, second] = parts;
      if (first === undefined || second === undefined) {
        throw new Error("expected two parts");
      }
      expect(["Khab", "Khad"]).toContain(first);
      expect(["Khedar", "Kharuk"]).toContain(second);
    });

    test("returns empty string for empty columns", () => {
      const bank: NameBank = { strategy: "spaceJoin", columns: [] };
      expect(generateFromBank(bank)).toBe("");
    });
  });

  describe("concat strategy", () => {
    test("concatenates two parts without separator", () => {
      const bank: NameBank = {
        strategy: "concat",
        columns: [["Ia"], ["mbril"]],
      };
      expect(generateFromBank(bank)).toBe("Iambril");
    });

    test("concatenates three parts", () => {
      const bank: NameBank = {
        strategy: "concat",
        columns: [["Ba"], ["bru"], ["cor"]],
      };
      expect(generateFromBank(bank)).toBe("Babrucor");
    });

    test("concatenates four parts", () => {
      const bank: NameBank = {
        strategy: "concat",
        columns: [["A"], ["b"], ["a"], ["ziel"]],
      };
      expect(generateFromBank(bank)).toBe("Abaziel");
    });

    test("picks one from each column", () => {
      const bank: NameBank = {
        strategy: "concat",
        columns: [
          ["Ia", "Ae"],
          ["mbril", "nor"],
        ],
      };
      const name = generateFromBank(bank);
      expect(["Iambril", "Ianor", "Aembril", "Aenor"]).toContain(name);
    });

    test("returns empty string for empty columns", () => {
      const bank: NameBank = { strategy: "concat", columns: [] };
      expect(generateFromBank(bank)).toBe("");
    });
  });

  describe("vowelSafeConcat strategy", () => {
    test("concatenates parts avoiding vowel-vowel collision", () => {
      const bank: NameBank = {
        strategy: "vowelSafeConcat",
        columns: [["Ka"], ["brin"]],
      };
      expect(generateFromBank(bank)).toBe("Kabrin");
    });

    test("avoids vowel-vowel joins when possible", () => {
      const bank: NameBank = {
        strategy: "vowelSafeConcat",
        columns: [
          ["Ka"],
          ["brin", "dor", "gar"],
        ],
      };
      for (let i = 0; i < 20; i++) {
        const name = generateFromBank(bank);
        expect(name).toMatch(/^Ka(brin|dor|gar)$/);
      }
    });

    test("still produces a result when all options cause vowel collision", () => {
      const bank: NameBank = {
        strategy: "vowelSafeConcat",
        columns: [
          ["Ka"],
          ["ael", "ith", "or"],
        ],
      };
      const name = generateFromBank(bank);
      expect(name.length).toBeGreaterThan(0);
    });

    test("handles multiple columns", () => {
      const bank: NameBank = {
        strategy: "vowelSafeConcat",
        columns: [["Th"], ["al"], ["dor"]],
      };
      expect(generateFromBank(bank)).toBe("Thaldor");
    });

    test("returns empty string for empty columns", () => {
      const bank: NameBank = { strategy: "vowelSafeConcat", columns: [] };
      expect(generateFromBank(bank)).toBe("");
    });
  });

  describe("blend strategy", () => {
    test("produces a non-empty string from two columns", () => {
      const bank: NameBank = {
        strategy: "blend",
        columns: [
          ["Chanterelle", "Porcini", "Morel"],
          ["Sporeling", "Mycelium", "Truffle"],
        ],
      };
      for (let i = 0; i < 20; i++) {
        const name = generateFromBank(bank);
        expect(name.length).toBeGreaterThan(0);
      }
    });

    test("returns empty string when a column is empty", () => {
      const bank: NameBank = { strategy: "blend", columns: [[], ["Truffle"]] };
      expect(generateFromBank(bank)).toBe("");
    });

    test("returns empty string when columns are missing", () => {
      const bank: NameBank = { strategy: "blend", columns: [] };
      expect(generateFromBank(bank)).toBe("");
    });

    test("blended name contains parts from source names", () => {
      const bank: NameBank = {
        strategy: "blend",
        columns: [["Abcdef"], ["Zyxwvu"]],
      };
      const name = generateFromBank(bank);
      expect(name.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("hyphenConcat strategy", () => {
    test("joins two parts with hyphen", () => {
      const bank: NameBank = {
        strategy: "hyphenConcat",
        columns: [["Ko"], ["Aman"]],
      };
      expect(generateFromBank(bank)).toBe("Ko-Aman");
    });

    test("picks one from each column", () => {
      const bank: NameBank = {
        strategy: "hyphenConcat",
        columns: [
          ["Ko", "To"],
          ["Aman", "Atun"],
        ],
      };
      const name = generateFromBank(bank);
      expect(name).toMatch(/^(Ko|To)-(Aman|Atun)$/);
    });

    test("handles missing first column gracefully", () => {
      const bank: NameBank = {
        strategy: "hyphenConcat",
        columns: [[], ["Aman"]],
      };
      expect(generateFromBank(bank)).toBe("Aman");
    });

    test("handles missing second column gracefully", () => {
      const bank: NameBank = {
        strategy: "hyphenConcat",
        columns: [["Ko"], []],
      };
      expect(generateFromBank(bank)).toBe("Ko");
    });
  });
});

describe("generateNamesFromBank", () => {
  test("generates requested count", () => {
    const bank: NameBank = {
      strategy: "pickOne",
      columns: [["Alice", "Bob", "Charlie"]],
    };
    const names = generateNamesFromBank(bank, 5);
    expect(names.length).toBe(5);
  });

  test("generates zero names when count is zero", () => {
    const bank: NameBank = {
      strategy: "pickOne",
      columns: [["Alice"]],
    };
    expect(generateNamesFromBank(bank, 0).length).toBe(0);
  });

  test("all generated names are non-empty", () => {
    const bank: NameBank = {
      strategy: "concat",
      columns: [
        ["Ia", "Ae"],
        ["mbril", "nor"],
      ],
    };
    const names = generateNamesFromBank(bank, 10);
    for (let i = 0; i < names.length; i++) {
      expect(names[i]?.length).toBeGreaterThan(0);
    }
  });
});
