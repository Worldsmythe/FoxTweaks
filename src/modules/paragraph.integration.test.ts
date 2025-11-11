import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "../core";
import { Paragraph } from "./paragraph";

interface History {
  text: string;
  type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
}

describe("Paragraph Module - Integration Tests", () => {
  beforeEach(() => {
    (globalThis as any).log = () => {};
    (globalThis as any).storyCards = [];
    (globalThis as any).state = {};
    (globalThis as any).info = {};
    (globalThis as any).addStoryCard = () => {};
  });

  test("should format output with doubleNewline formatting", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.\nThird paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toContain("\n\n");
  });

  test("should indent paragraphs when enabled", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: true`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toContain("    ");
  });

  test("should not modify output when disabled", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: false
FormattingType: doubleNewline
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  test("should handle formatting with none type", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: none
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  test("should handle successive AI outputs consistently", () => {
    const initialHistory: History[] = [
      { text: "You enter the room.", type: "do" },
    ];
    (globalThis as any).history = initialHistory;

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const firstOutput = "The room is dark.\nYou see a door.";
    const processedFirst = hooks.onOutput(firstOutput);

    (globalThis as any).history = [
      ...initialHistory,
      { text: processedFirst, type: "continue" },
    ];

    const secondOutput = "You approach the door.\nIt's locked.";
    const processedSecond = hooks.onOutput(secondOutput);

    expect(processedSecond).toContain("\n\n");
    const newlineCount = (processedSecond.match(/\n/g) || []).length;
    expect(newlineCount).toBeGreaterThan(1);
  });

  test("should handle empty output gracefully", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "";
    const processed = hooks.onOutput(output);

    expect(processed).toBe("");
  });

  test("should preserve existing double newlines", () => {
    (globalThis as any).history = [];

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const configCard = {
      id: 0,
      title: "FoxTweaks Config",
      keys: "Configure FoxTweaks behavior",
      description: `--- Paragraph ---
Enable: true
FormattingType: doubleNewline
IndentParagraphs: false`,
      type: "class",
      entry: "",
    };
    (globalThis as any).storyCards = [configCard];

    const hooks = core.createHooks();

    const output = "First paragraph.\n\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    const doubleNewlineCount = (processed.match(/\n\n/g) || []).length;
    expect(doubleNewlineCount).toBeGreaterThanOrEqual(1);
  });
});
