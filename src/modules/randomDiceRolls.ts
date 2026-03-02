import type { Module, VirtualContext } from "../types";
import {
  booleanValidator,
  stringValidator,
  objectValidator,
} from "../utils/validation";
import { appendToSection } from "../utils/virtualContext";

export interface RandomDiceRollsConfig {
  enable: boolean;
  sectionHeader: string;
  rolls: Record<string, string>;
}

export const RandomDiceRolls: Module<RandomDiceRollsConfig> = (() => {
  function validateConfig(raw: Record<string, unknown>): RandomDiceRollsConfig {
    return {
      enable: booleanValidator(raw, "enable"),
      sectionHeader: stringValidator(raw, "sectionheader", "Dice Rolls"),
      rolls: objectValidator<Record<string, string>>(raw, "rolls", {}),
    };
  }

  function rollDice(numDice: number, numSides: number): number {
    let total = 0;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * numSides) + 1;
    }
    return total;
  }

  function evaluateExpression(expression: string): number {
    let evaluated = expression;

    const dicePattern = /(\d+)d(\d+)/gi;
    evaluated = evaluated.replace(dicePattern, (_match, numDice, numSides) => {
      const result = rollDice(parseInt(numDice, 10), parseInt(numSides, 10));
      return result.toString();
    });

    const maxPattern = /max\(([^,]+),([^)]+)\)/gi;
    evaluated = evaluated.replace(maxPattern, (_match, a, b) => {
      const valA = evaluateExpression(a.trim());
      const valB = evaluateExpression(b.trim());
      return Math.max(valA, valB).toString();
    });

    const minPattern = /min\(([^,]+),([^)]+)\)/gi;
    evaluated = evaluated.replace(minPattern, (_match, a, b) => {
      const valA = evaluateExpression(a.trim());
      const valB = evaluateExpression(b.trim());
      return Math.min(valA, valB).toString();
    });

    try {
      const result = Function(`"use strict"; return (${evaluated})`)();
      return typeof result === "number" ? result : 0;
    } catch {
      return 0;
    }
  }

  function formatRollResults(
    rolls: Record<string, string>,
    header: string
  ): string {
    const lines: string[] = [header + ":"];

    for (const [label, expression] of Object.entries(rolls)) {
      const result = evaluateExpression(expression);

      const displayExpression = expression.replace(/\s+/g, " ").trim();
      const parts = displayExpression.split(/([+\-*/])/);

      if (parts.length > 1) {
        lines.push(`${label}: ${result} ${displayExpression}`);
      } else {
        lines.push(`${label}: ${result}`);
      }
    }

    return lines.join("\n");
  }

  function onContext(
    ctx: VirtualContext,
    config: RandomDiceRollsConfig
  ): VirtualContext {
    if (!config.enable) {
      return ctx;
    }

    const rollEntries = Object.entries(config.rolls);
    if (rollEntries.length === 0) {
      return ctx;
    }

    const formatted = formatRollResults(config.rolls, config.sectionHeader);
    return appendToSection(ctx, "Memories", "\n\n" + formatted + "\n");
  }

  return {
    name: "randomDiceRolls",
    configSection: `--- Random Dice Rolls ---
Enable: true
SectionHeader: Dice Rolls
# Roll definitions (label: expression):
Rolls:
  Misc 1: 1d100
  Misc 2: 1d100
  Misc 3: 1d100`,
    validateConfig,
    hooks: {
      onContext,
    },
  };
})();
