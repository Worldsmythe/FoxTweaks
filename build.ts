import * as fs from "fs";
import * as path from "path";
import * as prettier from "prettier";

const outDir = path.join(process.cwd(), "dist");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const banner = `/**
 * FoxTweaks for AI Dungeon
 * A modular plugin system for enhancing AI Dungeon gameplay
 *
 * Modules:
 * - DiceRoll: Automatic dice rolling for action attempts
 * - Interject: Temporary system messages to guide the AI
 * - Paragraph: Formatting and indentation control
 * - Redundancy: Detection and merging of redundant AI outputs
 * - BetterYou: Pronoun replacement for better narrative flow
 * - NarrativeChecklist: Track story objectives with AI-powered completion
 * - MarkdownHeaders: Format context headers with markdown
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput(text);
 *   Context modifier: text = FoxTweaks.Hooks.onContext(text);
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput(text);
 */`;

async function build() {
  try {
    const result = await Bun.build({
      entrypoints: ["src/library.ts"],
      outdir: "dist",
      target: "browser",
      format: "esm",
      minify: {
        syntax: true,
        whitespace: true,
      },
      sourcemap: "none",
      external: ["ai-dungeon-sdk"],
      naming: {
        entry: "foxtweaks.js",
      },
    });

    if (!result.success) {
      console.error("✗ Build failed:");
      for (const message of result.logs) {
        console.error(message);
      }
      process.exit(1);
    }

    const outputFile = "dist/foxtweaks.js";
    let code = fs.readFileSync(outputFile, "utf-8");

    // Format the output with prettier
    const formatted = await prettier.format(code, {
      parser: "babel",
      semi: true,
      trailingComma: "es5",
      singleQuote: false,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });
    fs.writeFileSync(outputFile, formatted);

    // Remove export statements and wrap in IIFE
    code = code
      .replace(/export\s*{\s*[^}]+\s*};?\s*$/gm, "")
      .replace(/export\s+/g, "")
      .replace(
        /export\s*{\s*FoxTweaks2 as FoxTweaks,\s*library_default as default\s*};?/g,
        ""
      )
      .replace(/\bvar\b/g, "const");

    // Wrap in IIFE that exposes FoxTweaks
    const wrapped = `${banner}
const FoxTweaks = (() => {
${code}
  return library_default;
})();
`;
    const formattedWrapped = await prettier.format(wrapped, {
      parser: "babel",
      semi: true,
      trailingComma: "es5",
      singleQuote: false,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });
    fs.writeFileSync(outputFile, formattedWrapped);

    console.log("✓ Build successful: dist/foxtweaks.js");

    const stats = fs.statSync(outputFile);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

build();
