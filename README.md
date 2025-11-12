# FoxTweaks

Worldsmythe's FoxTweaks script for AI Dungeon.

- [FoxTweaks](#foxtweaks)
  - [Features](#features)
    - [Dice Roll](#dice-roll)
    - [Interject](#interject)
    - [Paragraph](#paragraph)
    - [Redundancy](#redundancy)
    - [Better You](#better-you)
    - [Narrative Checklist](#narrative-checklist)
    - [Markdown Headers](#markdown-headers)
    - [Unified configuration system](#unified-configuration-system)
  - [Scenario Installation](#scenario-installation)
  - [For Developers](#for-developers)
    - [Why](#why)
    - [Building](#building)
    - [Testing](#testing)
    - [Formatting](#formatting)

## Features

- **Dice Roll**: Automatic dice rolling for action attempts (inspired by PoisonTea's Dice Roll script)
- **Interject**: Temporary system messages to guide the AI (inspired by TheMrEvil's [Interject](https://github.com/TheMrEvil/Interject))
- **Paragraph**: Formatting and indentation control (ported from Eliterose's [Paragraph Fix](https://github.com/Eliterose19/Paragraph-Fix) to fit in the unified configuration system)
- **Redundancy**: Detection and merging of redundant AI outputs (with fuzzy matching, by me)
- **Better You**: Pronoun replacement for better narrative flow that hasn't been fixed in over a year (by me)
- **Narrative Checklist**: Track story objectives with AI-powered completion detection
- **Markdown Headers**: Replace plain text context headers with markdown formatting

### Dice Roll

Type "try", "attempt", "cast", "attack", "shoot", "throw", or "brace yourself" (configurable) to roll a dice after a "do" action. Add custom modifier words for custom dice sets (configurable).

### Interject

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

### Narrative Checklist

Track story objectives and plot points with automatic AI-powered completion detection. Create a checklist of narrative goals, and the AI will periodically check if any items have been completed based on the story progression. The checklist is automatically injected into context to keep the AI focused on your story goals.

Features:

- Markdown checklist format (`- [ ]` unchecked, `- [x]` checked)
- Configurable turn interval for AI completion checks
- Automatic context injection (can be toggled)
- Context size management (truncates Recent Story if needed)
- Persistent tracking across story sessions

### Markdown Headers

Automatically converts plain text context headers into markdown format for better readability and organization. Uses stack-based bracket matching to properly handle Author's Note formatting.

Examples:

- `World Lore:` → `## World Lore`
- `Story Summary:` → `## Story Summary`
- `[Author's note: content here]` → `### Author's Note:\ncontent here`

### Unified configuration system

Card Body, used for Interject:

```
Type something here to emphasize it to the AI:

```

Card Description:

```
--- Dice ---
Enable: true  # Enable/disable dice rolling
# Trigger words that activate dice rolls:
Triggers: try, attempt, cast, attack, shoot, throw, brace yourself
# Default probability distribution (S=Crit Success, s=Success, p=Partial, f=Fail, F=Crit Fail):
Default: S s s s p f f F
# Custom probability sets:
Confident: S S s s s p p f f
Unconfident: s s p p f f f F F
# Words that trigger custom sets:
ConfidentWords: assuredly, confidently, doubtlessly, skillfully
UnconfidentWords: clumsily, tentatively, doubtfully, hesitantly, haphazardly

--- Interject ---
Enable: true  # Enable/disable interject feature
MaxTurns: 3  # Number of turns to show the interjected message
RemainingTurns: 0  # Countdown (managed automatically)

--- Paragraph ---
Enable: true  # Enable/disable paragraph formatting
# FormattingType options: none, basic, empty-line, newline
# - none: No formatting
# - basic: Converts multiple spaces/newlines to double newlines
# - empty-line: Basic + adds spacing before quotes (except after commas)
# - newline: Basic + newlines before quotes
FormattingType: none
IndentParagraphs: false  # Add 4-space indents to paragraphs

--- Redundancy ---
Enable: true  # Enable/disable redundancy detection and merging
# Similarity threshold (0-100) for fuzzy sentence matching:
SimilarityThreshold: 70

--- Better You ---
Enable: true  # Enable/disable pronoun replacements
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

--- Markdown Headers ---
Enable: true  # Replace plain text headers with markdown
HeaderLevel: ##  # Markdown header level (## or ###)

--- Narrative Checklist ---
Enable: true  # Enable narrative checklist tracking
MinTurnsBeforeCheck: 50  # Minimum turns between AI completion checks
RemainingTurns: 50  # Turns remaining until next check
AlwaysIncludeInContext: true  # Always include checklist in context
MinContextChars: 2000  # Minimum characters to preserve for recent story
```

To use the Narrative Checklist, create a story card titled "Narrative Checklist" with your objectives:

```markdown
- [ ] Find the ancient artifact
- [ ] Defeat the dragon
- [ ] Return to the village
```

The AI will automatically check for completed items every few turns and mark them as done (`- [x]`).

## Scenario Installation

1. Go [here](https://raw.githubusercontent.com/Worldsmythe/FoxTweaks/refs/heads/dist/foxtweaks.js) and download the latest release. Paste it at the top of your "Library" scripts.
2. Add the following to your "Input" modifier:

```javascript
text = FoxTweaks.Hooks.onInput(text);
```

3. Add the following to your "Context" modifier:

```javascript
text = FoxTweaks.Hooks.onContext(text);

// Place this below all other context modifiers
text = FoxTweaks.Hooks.reformatContext(text);
```

4. Add the following to your "Output" modifier:

```javascript
text = FoxTweaks.Hooks.onOutput(text);
```

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
