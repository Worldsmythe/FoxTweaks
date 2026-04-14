import { describe, test, expect, beforeEach } from "bun:test";
import { RandomNames } from "./randomNames";
import { parseContext, getSection } from "../utils/virtualContext";

describe("RandomNames Config Parsing", () => {
  test("parses enable key", () => {
    const config = RandomNames.validateConfig({ enable: true });
    expect(config.enable).toBe(true);
  });

  test("defaults enable to false", () => {
    const config = RandomNames.validateConfig({});
    expect(config.enable).toBe(false);
  });

  test("parses section header", () => {
    const config = RandomNames.validateConfig({
      sectionheader: "Custom Names",
    });
    expect(config.sectionHeader).toBe("Custom Names");
  });

  test("defaults section header", () => {
    const config = RandomNames.validateConfig({});
    expect(config.sectionHeader).toBe("Random Names");
  });

  test("parses Names from JSON string", () => {
    const config = RandomNames.validateConfig({
      names: '[{"prefix": "Test", "count": 3, "id": "default"}]',
    });
    expect(config.names.length).toBe(1);
    expect(config.names[0]?.prefix).toBe("Test");
    expect(config.names[0]?.count).toBe(3);
    expect(config.names[0]?.id).toBe("default");
  });

  test("parses Names from pre-parsed array", () => {
    const config = RandomNames.validateConfig({
      names: [{ prefix: "Test", count: 3, id: "default" }],
    });
    expect(config.names.length).toBe(1);
    expect(config.names[0]?.prefix).toBe("Test");
  });

  test("parses multiple name entries", () => {
    const config = RandomNames.validateConfig({
      names: '[{"prefix": "A", "count": 2, "id": "default"}, {"prefix": "B", "count": 4, "id": "fantasy"}]',
    });
    expect(config.names.length).toBe(2);
    expect(config.names[0]?.prefix).toBe("A");
    expect(config.names[1]?.prefix).toBe("B");
    expect(config.names[1]?.count).toBe(4);
  });

  test("defaults Names to empty array", () => {
    const config = RandomNames.validateConfig({});
    expect(config.names).toEqual([]);
  });

  test("drops invalid entries silently", () => {
    const config = RandomNames.validateConfig({
      names: [
        { prefix: "Valid", count: 3, id: "default" },
        { prefix: "Missing count", id: "default" },
        { count: 3, id: "default" },
        { prefix: "Zero count", count: 0, id: "default" },
      ],
    });
    expect(config.names.length).toBe(1);
    expect(config.names[0]?.prefix).toBe("Valid");
  });

  test("handles invalid JSON string gracefully", () => {
    const config = RandomNames.validateConfig({
      names: "not valid json",
    });
    expect(config.names).toEqual([]);
  });

  test("floors fractional counts", () => {
    const config = RandomNames.validateConfig({
      names: [{ prefix: "Test", count: 3.7, id: "default" }],
    });
    expect(config.names[0]?.count).toBe(3);
  });

  test("parses Names from nested object format", () => {
    const config = RandomNames.validateConfig({
      names: {
        "english masculine": {
          count: "3",
          id: "englishMasculine",
        },
        "english feminine": {
          count: "2",
          id: "englishFeminine",
        },
      },
    });
    expect(config.names.length).toBe(2);
    expect(config.names[0]?.prefix).toBe("English Masculine");
    expect(config.names[0]?.count).toBe(3);
    expect(config.names[0]?.id).toBe("englishMasculine");
    expect(config.names[1]?.prefix).toBe("English Feminine");
    expect(config.names[1]?.count).toBe(2);
  });

  test("skips nested name entries with missing id", () => {
    const config = RandomNames.validateConfig({
      names: {
        "test group": {
          count: "3",
        },
      },
    });
    expect(config.names.length).toBe(0);
  });

  test("defaults nested name count to 3", () => {
    const config = RandomNames.validateConfig({
      names: {
        "test group": {
          id: "englishMasculine",
        },
      },
    });
    expect(config.names[0]?.count).toBe(3);
  });
});

describe("RandomNames Context Injection", () => {
  let mockStoryCards: StoryCard[];
  let mockContext: {
    state: Record<string, unknown>;
    updateConfig: () => void;
    history: History[];
    storyCards: StoryCard[];
    info: Record<string, unknown>;
    ai: {
      requestPrompt: () => void;
      hasActivePrompt: () => boolean;
      getResponse: () => null;
      clearResponse: () => void;
    };
  };

  beforeEach(() => {
    mockStoryCards = [];
    mockContext = {
      state: {},
      updateConfig: () => {},
      history: [],
      storyCards: mockStoryCards,
      info: {},
      ai: {
        requestPrompt: () => {},
        hasActivePrompt: () => false,
        getResponse: () => null,
        clearResponse: () => {},
      },
    };
  });

  test("does not inject when disabled", () => {
    const config = RandomNames.validateConfig({ enable: false });
    const ctx = parseContext("Some context", []);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      expect(getSection(result, "Author's Note")).toBeUndefined();
    }
  });

  test("does not inject when Names is empty", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [],
    });
    const ctx = parseContext("Some context", []);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      expect(getSection(result, "Author's Note")).toBeUndefined();
    }
  });

  test("generates names from a structured bank", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [{ prefix: "Default Names", count: 3, id: "englishMasculine" }],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      expect(body).toContain("Random Names:");
      expect(body).toContain("Default Names:");
    }
  });

  test("generates multiple groups", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [
        { prefix: "English Masculine", count: 2, id: "englishMasculine" },
        { prefix: "English Feminine", count: 2, id: "englishFeminine" },
      ],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      expect(body).toContain("Random Names:");
      expect(body).toContain("English Masculine:");
      expect(body).toContain("English Feminine:");
    }
  });

  test("formats each group as prefix: name1, name2, name3", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [{ prefix: "Test", count: 3, id: "englishMasculine" }],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      const lines = body.split("\n").filter((l) => l.trim());
      const testLine = lines.find((l) => l.startsWith("Test:"));
      expect(testLine).toBeDefined();
      if (testLine) {
        const namesStr = testLine.replace("Test: ", "");
        const names = namesStr.split(", ");
        expect(names.length).toBe(3);
      }
    }
  });

  test("resolves id to story card when bank not found", () => {
    mockStoryCards.push({
      id: "custom",
      keys: "",
      title: "myCustomNames",
      entry: "Xavier\nYvonne\nZach",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      names: [{ prefix: "Custom", count: 3, id: "myCustomNames" }],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      expect(body).toContain("Custom:");
      expect(body).toMatch(/Xavier|Yvonne|Zach/);
    }
  });

  test("uses custom section header", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      sectionheader: "NPC Names",
      names: [{ prefix: "Test", count: 2, id: "englishMasculine" }],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      expect(body).toContain("NPC Names:");
      expect(body).not.toContain("Random Names:");
    }
  });

  test("respects per-entry count", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [{ prefix: "Test", count: 7, id: "englishMasculine" }],
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      const testLine = body
        .split("\n")
        .find((l) => l.startsWith("Test:"));
      expect(testLine).toBeDefined();
      if (testLine) {
        const names = testLine.replace("Test: ", "").split(", ");
        expect(names.length).toBe(7);
      }
    }
  });

  test("injects usage instructions when replacements are configured", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      names: [{ prefix: "Test", count: 2, id: "englishMasculine" }],
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishFeminine",
          segments: "1",
        },
      },
    });
    const ctx = parseContext("Some context", mockStoryCards);
    const result = RandomNames.hooks.onContext?.(ctx, config, mockContext);

    expect(result).toBeDefined();
    if (result) {
      const body = getSection(result, "Author's Note")?.body ?? "";
      expect(body).toContain("use names from the provided name lists");
    }
  });
});

describe("RandomNames Replacement Config Parsing", () => {
  test("parses replacement groups from nested object", () => {
    const config = RandomNames.validateConfig({
      replacements: {
        group1: {
          replacenames: "Elara, Lyra",
          replacefrom: "englishFeminine",
          segments: "1",
        },
      },
    });
    expect(config.replacements.length).toBe(1);
    expect(config.replacements[0]?.patterns).toEqual(["Elara", "Lyra"]);
    expect(config.replacements[0]?.bankId).toBe("englishFeminine");
    expect(config.replacements[0]?.segments).toBe(1);
  });

  test("parses multiple replacement groups", () => {
    const config = RandomNames.validateConfig({
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishFeminine",
          segments: "1",
        },
        group2: {
          replacenames: "Voss, Vance",
          replacefrom: "englishMasculine",
          segments: "-1",
        },
      },
    });
    expect(config.replacements.length).toBe(2);
    expect(config.replacements[1]?.segments).toBe(-1);
  });

  test("skips groups with missing replacenames", () => {
    const config = RandomNames.validateConfig({
      replacements: {
        group1: {
          replacefrom: "englishFeminine",
          segments: "1",
        },
      },
    });
    expect(config.replacements.length).toBe(0);
  });

  test("skips groups with missing replacefrom", () => {
    const config = RandomNames.validateConfig({
      replacements: {
        group1: {
          replacenames: "Elara",
          segments: "1",
        },
      },
    });
    expect(config.replacements.length).toBe(0);
  });

  test("defaults segments to 0 when missing", () => {
    const config = RandomNames.validateConfig({
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishFeminine",
        },
      },
    });
    expect(config.replacements[0]?.segments).toBe(0);
  });

  test("defaults replacements to empty array", () => {
    const config = RandomNames.validateConfig({});
    expect(config.replacements).toEqual([]);
  });
});

describe("RandomNames Output Replacement", () => {
  let mockStoryCards: StoryCard[];
  let mockContext: {
    state: Record<string, unknown>;
    updateConfig: () => void;
    history: History[];
    storyCards: StoryCard[];
    info: Record<string, unknown>;
    ai: {
      requestPrompt: () => void;
      hasActivePrompt: () => boolean;
      getResponse: () => null;
      clearResponse: () => void;
    };
  };

  beforeEach(() => {
    mockStoryCards = [];
    mockContext = {
      state: {},
      updateConfig: () => {},
      history: [],
      storyCards: mockStoryCards,
      info: {},
      ai: {
        requestPrompt: () => {},
        hasActivePrompt: () => false,
        getResponse: () => null,
        clearResponse: () => {},
      },
    };
  });

  test("replaces exact name matches in output", () => {
    mockStoryCards.push({
      id: "names",
      keys: "",
      title: "testNames",
      entry: "Xavier\nYvonne\nZach",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "testNames",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Elara walked into the room.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).not.toContain("Elara");
    expect(result).toMatch(/Xavier|Yvonne|Zach/);
    expect(result).toMatch(/walked into the room\./);
  });

  test("replaces wildcard prefix matches", () => {
    mockStoryCards.push({
      id: "names",
      keys: "",
      title: "testNames",
      entry: "Xavier\nYvonne\nZach",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Kael*",
          replacefrom: "testNames",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Kaelan and Kaela met Kael at the gate.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).not.toMatch(/Kael/);
    expect(result).toContain("at the gate.");
  });

  test("replaces wildcard suffix matches", () => {
    mockStoryCards.push({
      id: "names",
      keys: "",
      title: "testNames",
      entry: "Xavier\nYvonne\nZach",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "*vale",
          replacefrom: "testNames",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Sunvale is a nice place.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).not.toContain("Sunvale");
  });

  test("does not replace partial word matches", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishFeminine",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "McElara is not Elara.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).toContain("McElara");
  });

  test("extracts first segment with segments=1", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishMasculine",
          segments: "1",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Elara smiled.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    if (result) {
      const name = result.replace(" smiled.", "").trim();
      expect(name).not.toContain(" ");
    }
  });

  test("extracts last segment with segments=-1", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Henderson",
          replacefrom: "englishMasculine",
          segments: "-1",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Henderson nodded.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    if (result) {
      const name = result.replace(" nodded.", "").trim();
      expect(name).not.toContain(" ");
    }
  });

  test("does not replace when disabled", () => {
    const config = RandomNames.validateConfig({
      enable: false,
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "englishFeminine",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Elara walked away.",
      config,
      mockContext
    );
    expect(result).toBe("Elara walked away.");
  });

  test("returns text unchanged when no replacements configured", () => {
    const config = RandomNames.validateConfig({
      enable: true,
    });

    const result = RandomNames.hooks.onOutput?.(
      "Elara walked away.",
      config,
      mockContext
    );
    expect(result).toBe("Elara walked away.");
  });

  test("is case-sensitive", () => {
    mockStoryCards.push({
      id: "names",
      keys: "",
      title: "testNames",
      entry: "Xavier",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Elara",
          replacefrom: "testNames",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "elara is lowercase but Elara is capitalized.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).toContain("elara is lowercase");
    expect(result).not.toMatch(/\bElara\b/);
  });

  test("replaces same name consistently within one message", () => {
    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Lyra",
          replacefrom: "englishFeminine",
          segments: "0",
        },
      },
    });

    for (let attempt = 0; attempt < 10; attempt++) {
      const result = RandomNames.hooks.onOutput?.(
        '"Hello," said Lyra.\n"How are you?" asked Lyra.',
        config,
        mockContext
      );
      expect(result).toBeDefined();
      if (result) {
        const matches = result.match(/said (.+?)\./);
        const askedMatches = result.match(/asked (.+?)\./);
        expect(matches).toBeDefined();
        expect(askedMatches).toBeDefined();
        expect(matches?.[1]).toBe(askedMatches?.[1]);
      }
    }
  });

  test("replaces different names with different replacements", () => {
    mockStoryCards.push({
      id: "names",
      keys: "",
      title: "testNames",
      entry: "Xavier\nYvonne\nZach\nAlice\nBob",
      description: "",
    });

    const config = RandomNames.validateConfig({
      enable: true,
      replacements: {
        group1: {
          replacenames: "Lyra, Elara",
          replacefrom: "testNames",
          segments: "0",
        },
      },
    });

    const result = RandomNames.hooks.onOutput?.(
      "Lyra greeted Elara.",
      config,
      mockContext
    );
    expect(result).toBeDefined();
    expect(result).not.toContain("Lyra");
    expect(result).not.toContain("Elara");
  });
});
