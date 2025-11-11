# FoxTweaks

Worldsmythe's FoxTweaks script for AI Dungeon.

- [FoxTweaks](#foxtweaks)
  - [Features](#features)
    - [Dice Roll](#dice-roll)
    - [Interject](#interject)
    - [Paragraph](#paragraph)
    - [Redundancy](#redundancy)
    - [Better You](#better-you)
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

Replace the AI's pronouns with more appropriate ones. Covers the following cases:

- "me" -> "you"
- "mine" -> "yours"
- "Me" -> "You"
- "Mine" -> "Yours"
- ". you" -> ". You"
- '". you" -> '". You"

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
  . you: . You
  ." you: ." You
```

## Scenario Installation

1. Go [here](https://raw.githubusercontent.com/Worldsmythe/FoxTweaks/refs/heads/dist/foxtweaks.js) and download the latest release. Paste it at the top of your "Library" scripts.
2. Add the following to your "Input" modifier:

```javascript
text = FoxTweaks.Hooks.onInput({ text });
```

3. Add the following to your "Context" modifier:

```javascript
text = FoxTweaks.Hooks.onContext({ text });
```

4. Add the following to your "Output" modifier:

```javascript
text = FoxTweaks.Hooks.onOutput({ text });
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
