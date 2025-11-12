import { describe, expect } from "bun:test";
import { FoxTweaks } from "../core";
import { Paragraph } from "./paragraph";
import { testWithAiDungeonEnvironment, createConfigCard, addHistoryAction } from "../test-utils";

describe("Paragraph Module - Integration Tests", () => {

  testWithAiDungeonEnvironment("should format output with basic formatting", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false`);

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.\nThird paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toContain("\n\n");
  });

  testWithAiDungeonEnvironment("should indent paragraphs when enabled", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: true`);

    addHistoryAction("You enter the room.", "do");

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toContain("    ");
  });

  testWithAiDungeonEnvironment("should not modify output when disabled", () => {
    createConfigCard(`--- Paragraph ---
Enable: false
FormattingType: basic
IndentParagraphs: false`);

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  testWithAiDungeonEnvironment("should handle formatting with none type", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: none
IndentParagraphs: false`);

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "First paragraph.\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    expect(processed).toBe(output);
  });

  testWithAiDungeonEnvironment("should handle successive AI outputs consistently", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false`);

    addHistoryAction("You enter the room.", "do");

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const firstOutput = "The room is dark.\nYou see a door.";
    const processedFirst = hooks.onOutput(firstOutput);

    addHistoryAction(processedFirst, "continue");

    const secondOutput = "You approach the door.\nIt's locked.";
    const processedSecond = hooks.onOutput(secondOutput);

    expect(processedSecond).toContain("\n\n");
    const newlineCount = (processedSecond.match(/\n/g) || []).length;
    expect(newlineCount).toBeGreaterThan(1);
  });

  testWithAiDungeonEnvironment("should handle empty output gracefully", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false`);

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "";
    const processed = hooks.onOutput(output);

    expect(processed).toBe("");
  });

  testWithAiDungeonEnvironment("should preserve existing double newlines", () => {
    createConfigCard(`--- Paragraph ---
Enable: true
FormattingType: basic
IndentParagraphs: false`);

    const core = new FoxTweaks();
    core.registerModule(Paragraph);

    const hooks = core.createHooks();

    const output = "First paragraph.\n\nSecond paragraph.";
    const processed = hooks.onOutput(output);

    const doubleNewlineCount = (processed.match(/\n\n/g) || []).length;
    expect(doubleNewlineCount).toBeGreaterThanOrEqual(1);
  });
});
