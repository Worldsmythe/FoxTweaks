# Global Environment Explorer

A standalone function for exploring JavaScript environments (AI Dungeon, Node.js, browsers, etc.).

## Building

```bash
bun build explorer.ts --outfile explorer.js --target browser
```

Then paste `explorer.js` anywhere you need it.

## Usage

The explorer exports a single function `exploreEnvironment()` that returns a string:

```javascript
// Basic usage
const result = exploreEnvironment();
log(result);

// Custom exploration
const result = exploreEnvironment({
  keysToExplore: ["storyCards", "history", "myVariable"],
  scopeFunctions: ["addStoryCard", "log", "myFunction"],
  maxDepth: 3,
  maxFunctionBodyLength: 2000,
  showGlobalFunctions: true,
  showGlobalVariables: true,
  showPrototypes: false,
});
console.log(result);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `keysToExplore` | `string[]` | `["storyCards", "history", "state", "info"]` | Variables to explore in detail |
| `scopeFunctions` | `string[]` | `["addStoryCard", "removeStoryCard", ...]` | Functions to check in current scope |
| `maxDepth` | `number` | `3` | How many levels deep to explore objects |
| `maxFunctionBodyLength` | `number` | `2000` | Max characters to show for function bodies |
| `showGlobalFunctions` | `boolean` | `true` | Show all functions on globalThis |
| `showGlobalVariables` | `boolean` | `true` | Show all variables on globalThis |
| `showPrototypes` | `boolean` | `false` | Explore prototype chains |

## Icon Legend

The explorer uses unicode icons to save space:

| Icon | Meaning            |
| ---- | ------------------ |
| 📦   | Object             |
| 📋   | Array              |
| ⚙️   | Function           |
| 📝   | String             |
| 🔢   | Number             |
| ✓    | Boolean            |
| ∅    | Null/Undefined     |
| 🔄   | Circular reference |
| 🔗   | Prototype          |
| 📅   | Date               |
| 🔍   | RegExp             |
| 🗺️   | Map                |
| 🎯   | Set                |

## Example Output

```
=== 🔍 Global Environment ===

history 📋(5)
  [0] 📦 {
    text: "You enter the tavern."
    type: "do"
  }
  [1] 📦 {
    text: "The tavern is bustling."
    type: "continue"
  }
  +3 more

state 📦 {
  explorerHasRun: true
  memory 📦 {
    authorsNote: "Write in fantasy style."
    context: "You are a brave adventurer."
  }
}

info 📦 {
  actionCount: 5
  characterNames 📋(1)
  maxChars: 8000
  memoryLength: 150
}

addStoryCard ⚙️
removeStoryCard ⚙️
updateStoryCard ⚙️
log ⚙️
```

## Notes

- Runs once per adventure (uses `state.explorerHasRun`)
- Avoids infinite loops with circular reference detection
- Stops at well-known prototypes (Array, Object, etc.)
- Compacts output to save on character limits
