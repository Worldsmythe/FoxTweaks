import { describe, test, expect } from "bun:test";
import { MarkdownHeaders } from "./markdownHeaders";

describe("MarkdownHeaders Config Parsing", () => {
  test("parses lowercase keys", () => {
    const config = MarkdownHeaders.validateConfig({
      enable: true,
      headerlevel: "###",
    });
    expect(config.enable).toBe(true);
    expect(config.headerLevel).toBe("###");
  });

  test("uses defaults when keys missing", () => {
    const config = MarkdownHeaders.validateConfig({});
    expect(config.enable).toBe(true);
    expect(config.headerLevel).toBe("##");
  });
});
