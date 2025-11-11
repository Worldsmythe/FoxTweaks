import { describe, it, expect } from "bun:test";
import { escapeRegex, parseBool } from "./string";

describe("escapeRegex", () => {
  describe("special regex characters", () => {
    it("should escape dots", () => {
      expect(escapeRegex("file.txt")).toBe("file\\.txt");
    });

    it("should escape asterisks", () => {
      expect(escapeRegex("*.js")).toBe("\\*\\.js");
    });

    it("should escape plus signs", () => {
      expect(escapeRegex("a+b")).toBe("a\\+b");
    });

    it("should escape question marks", () => {
      expect(escapeRegex("what?")).toBe("what\\?");
    });

    it("should escape carets", () => {
      expect(escapeRegex("^start")).toBe("\\^start");
    });

    it("should escape dollar signs", () => {
      expect(escapeRegex("end$")).toBe("end\\$");
    });

    it("should escape curly braces", () => {
      expect(escapeRegex("a{1,3}")).toBe("a\\{1,3\\}");
    });

    it("should escape parentheses", () => {
      expect(escapeRegex("(group)")).toBe("\\(group\\)");
    });

    it("should escape pipe", () => {
      expect(escapeRegex("a|b")).toBe("a\\|b");
    });

    it("should escape square brackets", () => {
      expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
    });

    it("should escape backslashes", () => {
      expect(escapeRegex("path\\file")).toBe("path\\\\file");
    });
  });

  describe("complex patterns", () => {
    it("should escape multiple special characters", () => {
      expect(escapeRegex("*.{js,ts}")).toBe("\\*\\.\\{js,ts\\}");
    });

    it("should escape regex character class pattern", () => {
      expect(escapeRegex("[a-z]+")).toBe("\\[a-z\\]\\+");
    });

    it("should escape regex quantifier pattern", () => {
      expect(escapeRegex("a{2,4}?")).toBe("a\\{2,4\\}\\?");
    });

    it("should escape lookahead/lookbehind patterns", () => {
      expect(escapeRegex("(?=test)(?!fail)")).toBe(
        "\\(\\?=test\\)\\(\\?!fail\\)"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(escapeRegex("")).toBe("");
    });

    it("should preserve normal text", () => {
      expect(escapeRegex("hello world")).toBe("hello world");
    });

    it("should preserve alphanumeric characters", () => {
      expect(escapeRegex("abc123XYZ")).toBe("abc123XYZ");
    });

    it("should preserve spaces", () => {
      expect(escapeRegex("  multiple   spaces  ")).toBe(
        "  multiple   spaces  "
      );
    });

    it("should preserve safe punctuation", () => {
      expect(escapeRegex("hello, world!")).toBe("hello, world!");
    });
  });

  describe("practical use cases", () => {
    it("should escape glob pattern", () => {
      const escaped = escapeRegex("**/*.js");
      const regex = new RegExp(escaped);
      expect(regex.test("**/*.js")).toBe(true);
      expect(regex.test("anything")).toBe(false);
    });

    it("should escape file paths", () => {
      const escaped = escapeRegex("C:\\Users\\test.txt");
      expect(escaped).toBe("C:\\\\Users\\\\test\\.txt");
    });

    it("should escape URLs", () => {
      const escaped = escapeRegex("https://example.com?query=1");
      expect(escaped).toBe("https://example\\.com\\?query=1");
    });

    it("should escape user input safely", () => {
      const userInput = "(.*?)";
      const escaped = escapeRegex(userInput);
      expect(escaped).toBe("\\(\\.\\*\\?\\)");
    });
  });
});

describe("parseBool", () => {
  describe("true values", () => {
    it("should parse 'true' as true", () => {
      expect(parseBool("true")).toBe(true);
    });

    it("should parse 'TRUE' as true (case insensitive)", () => {
      expect(parseBool("TRUE")).toBe(true);
    });

    it("should parse 'True' as true (mixed case)", () => {
      expect(parseBool("True")).toBe(true);
    });

    it("should parse 't' as true", () => {
      expect(parseBool("t")).toBe(true);
    });

    it("should parse 'T' as true", () => {
      expect(parseBool("T")).toBe(true);
    });

    it("should parse 'yes' as true", () => {
      expect(parseBool("yes")).toBe(true);
    });

    it("should parse 'YES' as true", () => {
      expect(parseBool("YES")).toBe(true);
    });

    it("should parse 'y' as true", () => {
      expect(parseBool("y")).toBe(true);
    });

    it("should parse 'Y' as true", () => {
      expect(parseBool("Y")).toBe(true);
    });

    it("should parse 'on' as true", () => {
      expect(parseBool("on")).toBe(true);
    });

    it("should parse 'ON' as true", () => {
      expect(parseBool("ON")).toBe(true);
    });

    it("should parse '1' as true", () => {
      expect(parseBool("1")).toBe(true);
    });
  });

  describe("false values", () => {
    it("should parse 'false' as false", () => {
      expect(parseBool("false")).toBe(false);
    });

    it("should parse 'FALSE' as false", () => {
      expect(parseBool("FALSE")).toBe(false);
    });

    it("should parse 'f' as false", () => {
      expect(parseBool("f")).toBe(false);
    });

    it("should parse 'no' as false", () => {
      expect(parseBool("no")).toBe(false);
    });

    it("should parse 'n' as false", () => {
      expect(parseBool("n")).toBe(false);
    });

    it("should parse 'off' as false", () => {
      expect(parseBool("off")).toBe(false);
    });

    it("should parse '0' as false", () => {
      expect(parseBool("0")).toBe(false);
    });

    it("should parse empty string as false", () => {
      expect(parseBool("")).toBe(false);
    });

    it("should parse arbitrary text as false", () => {
      expect(parseBool("random")).toBe(false);
    });

    it("should parse numbers other than '1' as false", () => {
      expect(parseBool("2")).toBe(false);
      expect(parseBool("100")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle whitespace in values", () => {
      expect(parseBool("  true  ")).toBe(false); // Whitespace is not trimmed
    });

    it("should handle partial matches", () => {
      expect(parseBool("truthy")).toBe(false); // Must be exact match
      expect(parseBool("yes please")).toBe(false);
    });

    it("should handle numbers as strings", () => {
      expect(parseBool("1.0")).toBe(false); // Only "1" is truthy
    });
  });

  describe("common use cases", () => {
    it("should parse YAML boolean values", () => {
      expect(parseBool("true")).toBe(true);
      expect(parseBool("false")).toBe(false);
      expect(parseBool("yes")).toBe(true);
      expect(parseBool("no")).toBe(false);
      expect(parseBool("on")).toBe(true);
      expect(parseBool("off")).toBe(false);
    });

    it("should parse single character abbreviations", () => {
      expect(parseBool("t")).toBe(true);
      expect(parseBool("f")).toBe(false);
      expect(parseBool("y")).toBe(true);
      expect(parseBool("n")).toBe(false);
    });

    it("should parse numeric boolean representations", () => {
      expect(parseBool("1")).toBe(true);
      expect(parseBool("0")).toBe(false);
    });
  });
});
