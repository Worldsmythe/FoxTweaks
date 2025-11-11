import { describe, test, expect } from "bun:test";
import { Paragraph } from "./paragraph";

describe("Paragraph Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = Paragraph.validateConfig({
      enable: true,
      formattingtype: "basic",
      indentparagraphs: true,
    });
    expect(config.enable).toBe(true);
    expect(config.formattingType).toBe("basic");
    expect(config.indentParagraphs).toBe(true);
  });

  test("validates formattingtype enum", () => {
    const config = Paragraph.validateConfig({ formattingtype: "invalid" });
    expect(config.formattingType).toBe("none");
  });

  test("uses defaults when keys missing", () => {
    const config = Paragraph.validateConfig({});
    expect(config.enable).toBe(false);
    expect(config.formattingType).toBe("none");
    expect(config.indentParagraphs).toBe(false);
  });
});
