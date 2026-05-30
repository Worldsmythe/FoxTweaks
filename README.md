# FoxTweaks

Worldsmythe's FoxTweaks script for AI Dungeon.

- [FoxTweaks](#foxtweaks)
  - [Features](#features)
    - [Dice Roll](#dice-roll)
    - [Paragraph](#paragraph)
    - [Redundancy](#redundancy)
    - [Better You](#better-you)
    - [Random Names](#random-names)
    - [Placeholders](#placeholders)
    - [Unified configuration system](#unified-configuration-system)
  - [Scenario Script Installation Guide](#scenario-script-installation-guide)
  - [For Developers](#for-developers)
    - [Why](#why)
    - [Building](#building)
    - [Testing](#testing)
    - [Formatting](#formatting)

## Features

- **Dice Roll**: Automatic dice rolling for action attempts (inspired by PoisonTea's Dice Roll script)
- **Paragraph**: Formatting and indentation control (ported from Eliterose's [Paragraph Fix](https://github.com/Eliterose19/Paragraph-Fix) to fit in the unified configuration system)
- **Redundancy**: Detection and merging of redundant AI outputs (with fuzzy matching, by me)
- **Better You**: Pronoun replacement for better narrative flow that hasn't been fixed in over a year (by me)
- **Random Names**: Replace tropey names in AI output with generated names
- **Placeholders**: `{{...}}` markers for scene setup — fallbacks for skipped scenario placeholders, conditional branches and transclusion based on player input, character-creator capture into Plot Essentials, and one-shot scaffolding-card cleanup

### Dice Roll

Type "try", "attempt", "cast", "attack", "shoot", "throw", or "brace yourself" (configurable) to roll a dice after a "do" action. Add custom modifier words for custom dice sets (configurable).

Add a system message to the AI's context that will be displayed to the AI for a limited number of turns (configurable).

### Paragraph

Format the AI's output to be more readable. Supports the following formatting types:

- `none`: No formatting
- `basic`: Converts multiple spaces/newlines to double newlines
- `empty-line`: Basic + adds spacing before quotes (except after commas)
- `newline`: Basic + newlines before quotes

See Eliterose's [Paragraph Fix](https://github.com/Eliterose19/Paragraph-Fix) for more information.

### Redundancy

Detect and merge redundant AI outputs. For example, these two inputs:

> "Stop!" she yelled.

> "Stop!" she screamed. Her voice echoed.

Would be merged into:

> "Stop!" she screamed.

> Her voice echoed.

### Better You

Replace pronouns and fix capitalization for better narrative flow. Supports two types of replacements:

**Replacements** (applied outside dialogue only):
- "me" -> "you"
- "mine" -> "yours"
- "Me" -> "You"
- "Mine" -> "Yours"

**Patterns** (applied everywhere, including dialogue boundaries):
- ". you" -> ". You"
- '." you' -> '." You'

### Random Names

Replace tropey names in AI output with generated names.

### Placeholders

`{{...}}` markers placed inline in scenario text (Plot Essentials, AI Instructions, scenario start, story card entries). They run on the first script-eligible turn — the earliest moment scripts can read the character-creator output (per Latitude staff, no scripts run during `info.actionCount === 0`).

The markers run across three evaluation passes plus a one-shot card-removal sweep:

| Marker | What it does |
|---|---|
| `{{% comment %}}` | Stripped entirely. |
| `{{default <expr> \| <fallback>}}` | If `<expr>` resolves non-empty, use it. Otherwise use `<fallback>`. Wrap an AID `${name}` placeholder to give it a default when the player skips it. |
| `{{if <expr> ~= "<choices>" \| <then> \| <else>}}` | Levenshtein-fuzzy-match `<expr>` against comma-separated `<choices>`. Custom threshold via `~=85`. |
| `{{if <expr> == "<choices>" \| <then> \| <else>}}` | Case-insensitive exact match against any choice. |
| `{{if <expr> <op> <num> \| <then> \| <else>}}` | Numeric comparison (`<`, `>`, `<=`, `>=`, `==`, `!=`). Supports a single trailing arithmetic op on the LHS (e.g. `${age}+5 > 20`). |
| `{{if <expr> ~= "<cardType>" transclude}}` | Picks the story card of `type=<cardType>` whose title/key best matches `<expr>`, and emits its `entry` at the marker's position. Use `==` for exact match. |
| `{{filter <name> <expr> [\| <arg>...]}}` | Text transforms (filter name comes first): `capitalize`, `uncapitalize` (lowercase first char only, preserves the rest), `trim`, `lower`, `upper`, `replace \| <pattern> \| <replacement>` (regex with implicit `g` flag, `\n`/`\t` escapes in the replacement), `dedupe \| <needle>` (collapse adjacent runs of `<needle>` to a single instance — e.g. `{{filter dedupe 'fit body..' \| .}}` → `fit body.`). Composable via nesting: `{{filter capitalize {{extract "Name:"}}}}`. |
| `{{cleanup <expr> [\| <prefix> [\| <suffix>]]}}` | A detector for the AID `${Type $ if you have a thing.}{Thing prompt?}` pattern — typing `$` in the first promotes the next literal into a real `${...}` placeholder. If any `{prompt?}` literal (curly braces *not* preceded by `$`) remains in `<expr>` after AID's interpolation, the player didn't follow the toggle protocol, so cleanup emits empty so the outer `{{default}}` can fall through. Otherwise it trims `<expr>` and emits: bare → `cleaned`; 1-pipe → `prefix + " " + cleaned`; 2-pipe → `prefix + " " + cleaned + suffix`. Empty `<expr>` also emits empty in every mode. |
| `{{capture}}` | Emits the character-creator opening output at the marker's position (cached on the first eligible turn). |
| `{{capture into=<section> paragraph=<N>}}` | Removes the marker and injects the captured output as paragraph `N` of `<section>`. |
| `{{extract <prefix>}}` | Pulls a field value out of the captured creator output. `<prefix>` may be a literal like `"Name:"` or a regex literal `/Name:\s*(\w+)/`. |
| `{{removepost <marker>}}` | After value markers settle, truncate the section body at the first occurrence of `<marker>`. |
| `{{removepre <marker>}}` | After value markers settle, drop everything before (and including) the first occurrence of `<marker>`. |
| `{{remove}}` | Placed in a story card's body or keys, deletes that card during the one-shot sweep on the first eligible turn. |

**Skipped placeholder fallback.** Wrap an optional AID placeholder so it gets a sensible default when the player declines to fill it in:

```
You are {{default ${name} | a nameless wanderer}}.
```

**Conditional traveling companion.** AID's `${...}` placeholder system can be chained: typing `$` in `${Type $ if you have a thing.}` turns the next `{Thing prompt?}` literal into a real `${Thing prompt?}` that AID then asks. Combine with `{{cleanup}}` and `{{default}}`:

```
{{default
  {{cleanup ${Type $ if you have a travelling companion.}{Traveling companion's name?} | You are traveling with | ,}}
  {{cleanup ${Type $ if you have a travelling companion.}{Traveling companion's physical description?}}}
| You are traveling alone.}}
```

If the player types `$` and fills in both fields, the two cleanups produce `You are traveling with Kira,` and `A warrior of some renown with auburn hair and green eyes.` — the `{{default}}` joins them. If the player skips, both cleanups return empty and the outer fallback `You are traveling alone.` wins.

**Choose-a-weapon via transclusion.** Define story cards of `type=mythical-weapons` for Excalibur, Mjolnir, and Zeus' Bolt. In Plot Essentials, write:

```
Your weapon of choice: {{if ${weapon} ~= "mythical-weapons" transclude}}
```

The player's pick is fuzzy-matched against the cards' titles/keys; the chosen card's body is emitted in place.

**Character-creator capture.** Combine `{{extract}}` to lift fields out of the creator's output, `{{capture}}` to drop in the whole text, and `{{removepost}}` to crop the AI's prose follow-up. Put on the scaffolding card body the literal `{{remove}}` so the card is auto-deleted on the first turn:

```
Plot Essentials:
Name: {{extract "Name:"}}
Class: {{extract "Class:"}}

{{capture}}
{{removepost "You are"}}
```

```
Scaffolding card body (deleted on turn 1):
Choose your class from: warrior, mage, rogue.
{{remove}}
```

### Unified configuration system

Card Body, used for Interject:

```
Type something here to emphasize it to the AI:

```

Card Description:

```
---- Dice ---
Enable: true # Enable/disable dice rolling
# Trigger words that activate dice rolls:
Triggers: try, attempt, cast, attack, shoot, throw, brace yourself
# Default probability distribution (S=Crit Success, s=Success, p=Partial, f=Fail, F=Crit Fail):
Default: S s s s p f f F
# Outcome labels (customize the text for each outcome):
OutcomeLabels:
  S: Critical Success!
  s: Success
  p: Partial Success
  f: Failure
  F: Critical Failure!
# Custom probability sets:
# Words that trigger custom sets:
CustomSets:
  Confident:
    Outcomes: S S s s s p p f f
    Words: assuredly, confidently, doubtlessly, skillfully
  Unconfident:
    Outcomes: s s p p f f f F F
    Words: clumsily, tentatively, doubtfully, hesitantly, haphazardly

--- Paragraph ---
Enable: true # Enable/disable paragraph formatting
# FormattingType options: none, basic, empty-line, newline
# - none: No formatting
# - basic: Converts multiple spaces/newlines to double newlines
# - empty-line: Basic + adds spacing before quotes (except after commas)
# - newline: Basic + newlines before quotes
FormattingType: basic
IndentParagraphs: false  # Add 4-space indents to paragraphs

--- Redundancy ---
Enable: true # Enable/disable redundancy detection and merging
# Similarity threshold (0-100) for fuzzy sentence matching:
SimilarityThreshold: 70

--- Better You ---
Enable: true # Enable/disable pronoun replacements
# Replace words outside of dialogue (respects word boundaries):
Replacements:
  me: you
  mine: yours
  Me: You
  Mine: Yours
# Pattern replacements applied everywhere (including dialogue):
Patterns:
  . you: . You
  ." you: ." You

--- Random Names ---
Enable: true
SectionHeader: Random Names
Names:
  English Masculine:
    Count: 3
    Id: englishMasculine
  English Feminine:
    Count: 3
    Id: englishFeminine
Replacements:
  LastNames:
    ReplaceNames: Voss, Vance, Henderson, Chen, Thorne
    ReplaceFrom: englishMasculine
    Segments: -1
  Feminine:
    ReplaceNames: Lyra, Lena, Anya, Elara, Kaela, Kaelin, Clara, Seraphina, Valeria, Sasha, Clara
    ReplaceFrom: englishFeminine
    Segments: 1
  Masculine:
    ReplaceNames: Kael, Kaelan, Valerian, Valerius
    ReplaceFrom: englishMasculine
    Segments: 1
```

## Scenario Script Installation Guide
1. Use the [AI Dungeon website](https://aidungeon.com/) on PC (or view as desktop if mobile-only)
2. [Create a new scenario](https://help.aidungeon.com/faq/what-are-scenarios) or edit one of your existing scenarios
3. Open the `DETAILS` tab at the top while editing your scenario
4. Scroll down to `Scripting` and toggle ON → `Scripts Enabled`
5. Select `EDIT SCRIPTS`
6. Select the `Input` tab on the left
7. Delete all code within said tab
8. Copy and paste the following code into your empty `Input` tab:
```javascript
// Your "Input" tab should look like this
// InnerSelf can go here if you want to use it, just delete the "// " on the next line
// InnerSelf("input")
const modifier = (text) => {
  text = FoxTweaks.Hooks.onInput(text);
  // AutoCards can go here if you want to use it, just delete the "// " on the next line
  // text = AutoCards("input", text);
  return {text};
};
modifier(text);
```
9. Select the `Context` tab on the left
10. Delete all code within said tab
11. Copy and paste the following code into your empty `Context` tab:
```javascript
// Your "Context" tab should look like this
// InnerSelf can go here if you want to use it, just delete the "// " on the next line
// InnerSelf("context")
const modifier = (text) => {
  text = FoxTweaks.Hooks.onContext(text);
  // AutoCards can go here if you want to use it, just delete the "// " on the next line
  // text = AutoCards("input", text);
  return {text};
};
modifier(text);
```
12. Select the `Output` tab on the left
13. Delete all code within said tab
14. Copy and paste the following code into your empty `Output` tab:
```javascript
// Your "Output" tab should look like this
// InnerSelf can go here if you want to use it, just delete the "// " on the next line
// InnerSelf("output")
const modifier = (text) => {
  text = FoxTweaks.Hooks.onOutput(text);
  // AutoCards can go here if you want to use it, just delete the "// " on the next line
  // text = AutoCards("output", text);
  return {text};
};
modifier(text);
```
15. Select the `Library` tab on the left
16. Delete all code within said tab
17. Open my full Library code (hyperlink below) in a new browser tab

- [Library code](https://raw.githubusercontent.com/Worldsmythe/FoxTweaks/refs/heads/dist/foxtweaks.js).  
18. Copy my *full* code from the page above and paste into your empty `Library` tab. You can paste it above or below other scripts like 
[AutoCards](https://github.com/LewdLeah/Auto-Cards) or 
[InnerSelf](https://github.com/LewdLeah/Inner-Self).

19. Click the big yellow `SAVE` button in the top right corner
20. And you're done!

## For Developers

FoxTweaks is written in TypeScript and built from a collection of modules. The core library is in `src/library.ts`, and the modules are in `src/modules/`. This includes utilities for many of the things that I had to do across the modules.

### Why

- I wanted a single configuration card
- I wanted autocomplete when I was writing the scripts
- I had to rewrite a bunch of config handling over and over for each script I wrote
- I wanted to be able to easily add new modules to the system

### Building

To build the project, run `bun run build`. This will create a `dist/foxtweaks.js` file that you can paste at the top of your "Library" scripts.

### Testing

To run the tests, run `bun test`. This will run the tests and report the results.

### Formatting

To format the code, run `bun run format`. This will format the code according to the prettier configuration.
