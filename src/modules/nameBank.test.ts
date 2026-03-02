import { describe, test, expect } from "bun:test";
import {
  parseNameBank,
  generateName,
  generateNames,
  getNamesFromNameBank,
} from "./nameBank";
import { STRUCTURED_NAME_BANKS } from "./nameBanks";

describe("parseNameBank", () => {
  test("parses single-column names", () => {
    const columns = parseNameBank("Alice\nBob\nCharlie");
    expect(columns).toEqual([["Alice", "Bob", "Charlie"]]);
  });

  test("parses two-column names", () => {
    const columns = parseNameBank("Oort, Alpha\nTryphax, Beta\nCortex, Prime");
    expect(columns).toEqual([
      ["Oort", "Tryphax", "Cortex"],
      ["Alpha", "Beta", "Prime"],
    ]);
  });

  test("parses three-column names", () => {
    const columns = parseNameBank("Aa, el, dor\nAe, lar, ion\nAr, wyn, eth");
    expect(columns).toEqual([
      ["Aa", "Ae", "Ar"],
      ["el", "lar", "wyn"],
      ["dor", "ion", "eth"],
    ]);
  });

  test("handles mixed single and multi-column", () => {
    const columns = parseNameBank("Oort, Alpha\nNexus\nCortex, Prime");
    expect(columns).toEqual([
      ["Oort", "Nexus", "Cortex"],
      ["Alpha", "Prime"],
    ]);
  });

  test("preserves spaces within parts", () => {
    const columns = parseNameBank(
      "Red Dragon, Fire Breath\nBlue Dragon, Ice Breath"
    );
    expect(columns).toEqual([
      ["Red Dragon", "Blue Dragon"],
      ["Fire Breath", "Ice Breath"],
    ]);
  });

  test("trims whitespace around commas", () => {
    const columns = parseNameBank("Oort , Alpha \n Tryphax ,  Beta  ");
    expect(columns).toEqual([
      ["Oort", "Tryphax"],
      ["Alpha", "Beta"],
    ]);
  });

  test("filters empty lines", () => {
    const columns = parseNameBank("Alice\n\n\nBob\n\nCharlie");
    expect(columns).toEqual([["Alice", "Bob", "Charlie"]]);
  });

  test("filters empty parts from comma separation", () => {
    const columns = parseNameBank("Alice,\n,Bob\nCharlie,,");
    expect(columns).toEqual([["Alice", "Bob", "Charlie"]]);
  });
});

describe("generateName", () => {
  test("generates from single column", () => {
    const columns = [["Alice", "Bob", "Charlie"]];
    const name = generateName(columns);
    expect(["Alice", "Bob", "Charlie"]).toContain(name);
  });

  test("generates from two columns", () => {
    const columns = [
      ["Oort", "Tryphax"],
      ["Alpha", "Beta"],
    ];
    const name = generateName(columns);
    expect(name.split(" ").length).toBe(2);
    expect(["Oort", "Tryphax"]).toContain(name.split(" ")[0]);
    expect(["Alpha", "Beta"]).toContain(name.split(" ")[1]);
  });

  test("generates from three columns", () => {
    const columns = [
      ["Aa", "Ae"],
      ["el", "lar"],
      ["dor", "ion"],
    ];
    const name = generateName(columns);
    expect(name.split(" ").length).toBe(3);
  });

  test("preserves spaces in parts", () => {
    const columns = [["Red Dragon", "Blue Dragon"], ["Fire Breath"]];
    const name = generateName(columns);
    expect(["Red Dragon Fire Breath", "Blue Dragon Fire Breath"]).toContain(
      name
    );
  });

  test("returns empty string for empty columns", () => {
    const columns: string[][] = [];
    const name = generateName(columns);
    expect(name).toBe("");
  });
});

describe("generateNames", () => {
  test("generates requested count of names", () => {
    const columns = [["Alice", "Bob", "Charlie"]];
    const names = generateNames(columns, 5);
    expect(names.length).toBe(5);
    for (const name of names) {
      expect(["Alice", "Bob", "Charlie"]).toContain(name);
    }
  });

  test("generates zero names when count is zero", () => {
    const columns = [["Alice", "Bob"]];
    const names = generateNames(columns, 0);
    expect(names.length).toBe(0);
  });

  test("generates multi-part names", () => {
    const columns = [
      ["Oort", "Tryphax"],
      ["Alpha", "Beta"],
    ];
    const names = generateNames(columns, 3);
    expect(names.length).toBe(3);
    for (const name of names) {
      expect(name.split(" ").length).toBe(2);
    }
  });
});

describe("getNamesFromNameBank", () => {
  test("falls back to story card when bank name not found", () => {
    const mockCards: StoryCard[] = [
      {
        id: "custom",
        keys: "",
        title: "mybank",
        entry: "Xavier\nYvonne\nZach",
        description: "",
      },
    ];
    const names = getNamesFromNameBank("mybank", mockCards, 3);
    expect(names.length).toBe(3);
    for (const name of names) {
      expect(["Xavier", "Yvonne", "Zach"]).toContain(name);
    }
  });

  test("generates multi-column names from story card", () => {
    const mockCards: StoryCard[] = [
      {
        id: "custom",
        keys: "",
        title: "multicolumn",
        entry: "Oort, Alpha\nTryphax, Beta\nCortex, Prime",
        description: "",
      },
    ];
    const names = getNamesFromNameBank("multicolumn", mockCards, 3);
    expect(names.length).toBe(3);
    for (const name of names) {
      expect(name.split(" ").length).toBe(2);
    }
  });

  test("handles story card with spaces in parts", () => {
    const mockCards: StoryCard[] = [
      {
        id: "custom",
        keys: "",
        title: "spaces",
        entry: "Red Dragon, Fire Breath\nBlue Dragon, Ice Breath",
        description: "",
      },
    ];
    const names = getNamesFromNameBank("spaces", mockCards, 2);
    expect(names.length).toBe(2);
    for (const name of names) {
      expect(name).toMatch(/Dragon.*Breath/);
    }
  });
});