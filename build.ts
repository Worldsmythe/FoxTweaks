import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import * as prettier from "prettier";

const outDir = path.join(process.cwd(), "dist");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function build() {
  try {
    await esbuild.build({
      entryPoints: ["src/library.ts"],
      bundle: true,
      format: "esm",
      outfile: "dist/foxtweaks.js",
      platform: "neutral",
      target: "es2022",
      minify: false,
      keepNames: false,
      treeShaking: true,
      sourcemap: false,
      external: ["ai-dungeon-sdk"],
      banner: {
        js: `/**
 * FoxTweaks for AI Dungeon
 * A modular plugin system for enhancing AI Dungeon gameplay
 *
 * Modules:
 * - DiceRoll: Automatic dice rolling for action attempts
 * - Interject: Temporary system messages to guide the AI
 * - Paragraph: Formatting and indentation control
 * - Redundancy: Detection and merging of redundant AI outputs
 * - BetterYou: Pronoun replacement for better narrative flow
 *
 * Usage:
 *   Input modifier:   text = FoxTweaks.Hooks.onInput({ text });
 *   Context modifier: text = FoxTweaks.Hooks.onContext({ text });
 *   Output modifier:  text = FoxTweaks.Hooks.onOutput({ text });
 */`,
      },
    });

    const outputFile = "dist/foxtweaks.js";
    let code = fs.readFileSync(outputFile, "utf-8");

    code = code
      .replace(/var FoxTweaks2 = {/g, "return {")
      .replace(/var library_default = FoxTweaks2;/g, "")
      .replace(
        /export\s*{\s*FoxTweaks2 as FoxTweaks,\s*library_default as default\s*};?/g,
        ""
      )
      .replace(/\bvar\b/g, "const");

    // Find where the banner ends (after the closing comment)
    const bannerEnd = code.indexOf("*/") + 2;
    const banner = code.substring(0, bannerEnd);
    const content = code.substring(bannerEnd);

    // Wrap everything in an IIFE that only exposes FoxTweaks
    const wrapped = `${banner}
const FoxTweaks = (() => {
${content}
})();
`;

    // Format the output with prettier
    const formatted = await prettier.format(wrapped, {
      parser: "babel",
      semi: true,
      trailingComma: "es5",
      singleQuote: false,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });

    fs.writeFileSync(outputFile, formatted);

    console.log("✓ Build successful: dist/foxtweaks.js");

    const stats = fs.statSync(outputFile);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

build();
