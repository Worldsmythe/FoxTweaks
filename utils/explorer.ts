interface ExplorerOptions {
  keysToExplore?: string[];
  scopeFunctions?: string[];
  maxDepth?: number;
  maxFunctionBodyLength?: number;
  showGlobalFunctions?: boolean;
  showGlobalVariables?: boolean;
  showPrototypes?: boolean;
}

function exploreEnvironment(options: ExplorerOptions = {}): string {
  const {
    keysToExplore = ["storyCards", "history", "state", "info"],
    scopeFunctions = [
      "addStoryCard",
      "removeStoryCard",
      "updateStoryCard",
      "updateStoryCards",
      "updateState",
      "log",
    ],
    maxDepth = 3,
    maxFunctionBodyLength = 2000,
    showGlobalFunctions = true,
    showGlobalVariables = true,
    showPrototypes = false,
  } = options;

  const output: string[] = [];

  // Helper functions
  function buildWellKnownPrototypes(): Set<unknown> {
    const prototypes = new Set<unknown>();
    const types = [
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Error,
      typeof Map !== "undefined" ? Map : null,
      typeof Set !== "undefined" ? Set : null,
      typeof WeakMap !== "undefined" ? WeakMap : null,
      typeof WeakSet !== "undefined" ? WeakSet : null,
      typeof Promise !== "undefined" ? Promise : null,
      Function,
    ];
    for (const type of types) {
      if (type && type.prototype) {
        prototypes.add(type.prototype);
      }
    }
    return prototypes;
  }

  const WELL_KNOWN_PROTOTYPES = buildWellKnownPrototypes();

  function isWellKnownPrototype(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    return WELL_KNOWN_PROTOTYPES.has(obj);
  }

  function getTypeName(value: unknown): string {
    if (value === null) return "∅";
    if (value === undefined) return "∅";
    if (typeof value === "function") return "⚙️";
    if (Array.isArray(value)) return "📋";

    try {
      if (typeof Date !== "undefined" && value instanceof Date) return "📅";
      if (typeof RegExp !== "undefined" && value instanceof RegExp) return "🔍";
      if (typeof Map !== "undefined" && value instanceof Map) return "🗺️";
      if (typeof Set !== "undefined" && value instanceof Set) return "🎯";
    } catch (e) {
      // instanceof might fail in some environments
    }

    if (typeof value === "string") return "📝";
    if (typeof value === "number") return "🔢";
    if (typeof value === "boolean") return "✓";
    if (typeof value === "object") {
      try {
        const proto = Object.getPrototypeOf(value);
        if (proto && proto.constructor && proto.constructor.name) {
          return `📦${proto.constructor.name}`;
        }
      } catch (e) {
        // getPrototypeOf might fail
      }
      return "📦";
    }
    return typeof value;
  }

  function getFunctionBody(fn: Function, maxLength: number): string {
    try {
      const fnStr = fn.toString();
      if (fnStr.includes("[native code]")) {
        return "⚡ native";
      }
      if (fnStr.length > maxLength) {
        return (
          fnStr.substring(0, maxLength) +
          `\n... [${fnStr.length - maxLength} more chars]`
        );
      }
      return fnStr;
    } catch (e) {
      return "⚡ unavailable";
    }
  }

  function exploreProp(
    obj: unknown,
    path: string,
    depth: number,
    indent: string,
    seen: WeakSet<object>
  ): void {
    if (depth > maxDepth) {
      output.push(`${indent}[max depth reached]`);
      return;
    }

    if (obj === null || obj === undefined) {
      output.push(`${indent}${getTypeName(obj)}`);
      return;
    }

    if (typeof obj === "object") {
      if (seen.has(obj)) {
        output.push(`${indent}🔄 circular`);
        return;
      }

      if (isWellKnownPrototype(obj)) {
        output.push(`${indent}🔗 prototype`);
        return;
      }

      seen.add(obj);
    }

    if (
      typeof obj === "string" ||
      typeof obj === "number" ||
      typeof obj === "boolean"
    ) {
      const preview =
        typeof obj === "string" && obj.length > 50
          ? `"${obj.substring(0, 50)}..."`
          : JSON.stringify(obj);
      output.push(`${indent}${getTypeName(obj)}: ${preview}`);
      return;
    }

    if (Array.isArray(obj)) {
      output.push(`${indent}📋(${obj.length})`);
      if (obj.length > 0 && depth < maxDepth) {
        const preview = obj.slice(0, 3);
        for (let i = 0; i < preview.length; i++) {
          const item = preview[i];
          output.push(`${indent}  [${i}] ${getTypeName(item)}`);
          if (
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item)
          ) {
            exploreProp(
              item,
              `${path}[${i}]`,
              depth + 1,
              `${indent}    `,
              seen
            );
          }
        }
        if (obj.length > 3) {
          output.push(`${indent}  +${obj.length - 3} more`);
        }
      }
      return;
    }

    if (typeof obj === "object") {
      const typeName = getTypeName(obj);
      output.push(`${indent}${typeName} {`);

      const keys = Object.keys(obj);
      const ownProps = Object.getOwnPropertyNames(obj);
      const allKeys = new Set([...keys, ...ownProps]);
      const sortedKeys = Array.from(allKeys).sort();

      for (const key of sortedKeys) {
        const value = (obj as Record<string, unknown>)[key];
        const valueType = getTypeName(value);

        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null ||
          value === undefined
        ) {
          const preview =
            typeof value === "string" && value.length > 50
              ? `"${value.substring(0, 50)}..."`
              : JSON.stringify(value);
          output.push(`${indent}  ${key}: ${preview}`);
        } else if (Array.isArray(value)) {
          output.push(`${indent}  ${key} 📋(${value.length})`);
          if (depth < maxDepth && value.length > 0) {
            exploreProp(
              value,
              `${path}.${key}`,
              depth + 1,
              `${indent}    `,
              seen
            );
          }
        } else if (typeof value === "object") {
          output.push(`${indent}  ${key} ${valueType}`);
          if (depth < maxDepth) {
            exploreProp(
              value,
              `${path}.${key}`,
              depth + 1,
              `${indent}    `,
              seen
            );
          }
        } else if (typeof value === "function") {
          const body = getFunctionBody(value, maxFunctionBodyLength);
          if (body === "⚡ native") {
            output.push(`${indent}  ${key} ⚙️ native`);
          } else {
            output.push(
              `${indent}  ${key} ⚙️\n${indent}    ${body.replace(/\n/g, `\n${indent}    `)}`
            );
          }
        } else {
          output.push(`${indent}  ${key} ${valueType}`);
        }
      }

      if (showPrototypes && depth < maxDepth) {
        const proto = Object.getPrototypeOf(obj);
        if (proto && !isWellKnownPrototype(proto)) {
          output.push(`${indent}  🔗 ${getTypeName(proto)}`);
          exploreProp(
            proto,
            `${path}.__proto__`,
            depth + 1,
            `${indent}    `,
            seen
          );
        }
      }

      output.push(`${indent}}`);
    }
  }

  function discoverGlobals(): string[] {
    const globals: string[] = [];
    const banned = new Set([
      "constructor",
      "prototype",
      "__proto__",
      "then",
      "catch",
      "finally",
    ]);

    try {
      for (const key in globalThis) {
        if (!banned.has(key)) {
          globals.push(key);
        }
      }

      const ownKeys = Object.getOwnPropertyNames(globalThis);
      for (const key of ownKeys) {
        if (!banned.has(key) && !globals.includes(key)) {
          globals.push(key);
        }
      }
    } catch (e) {
      output.push(`Error discovering globals: ${e}`);
    }

    return globals.sort();
  }

  // Main exploration logic
  output.push("=== 🌍 Environment Discovery ===\n");

  // 1. Explore scope functions
  output.push("⚙️ Scope Functions:");
  for (const fnName of scopeFunctions) {
    try {
      const exists = eval(`typeof ${fnName} !== 'undefined'`);
      if (exists) {
        const fn = eval(fnName);
        if (typeof fn === "function") {
          const body = getFunctionBody(fn, maxFunctionBodyLength);
          const isNative = body === "⚡ native";
          if (isNative) {
            output.push(`  ✓ ${fnName}: ⚡ native`);
          } else {
            output.push(`  ✓ ${fnName}:\n${body}\n`);
          }
        } else {
          output.push(`  ✓ ${fnName}: ${typeof fn}`);
        }
      } else {
        output.push(`  ✗ ${fnName}: undefined`);
      }
    } catch (e) {
      output.push(`  ✗ ${fnName}: ⚠️ ${e}`);
    }
  }

  output.push("\n");

  // 2. Explore globalThis
  if (showGlobalFunctions || showGlobalVariables) {
    const allGlobals = discoverGlobals();
    const functions: string[] = [];
    const variables: string[] = [];

    for (const key of allGlobals) {
      try {
        const value = (globalThis as Record<string, unknown>)[key];
        if (typeof value === "function") {
          functions.push(key);
        } else if (value !== undefined) {
          variables.push(key);
        }
      } catch (e) {
        // Skip inaccessible properties
      }
    }

    if (showGlobalFunctions) {
      output.push(`⚙️ globalThis Functions (${functions.length}):`);
      for (const fn of functions) {
        try {
          const value = (globalThis as Record<string, unknown>)[fn] as Function;
          const body = getFunctionBody(value, maxFunctionBodyLength);
          const isNative = body === "⚡ native";
          if (isNative) {
            output.push(`  ${fn}: ⚡ native`);
          } else {
            output.push(`  ${fn}:\n${body}\n`);
          }
        } catch (e) {
          output.push(`  ${fn}: ⚠️ error`);
        }
      }
      output.push("\n");
    }

    if (showGlobalVariables) {
      output.push(`📦 globalThis Variables (${variables.length}):`);
      const displayCount = Math.min(20, variables.length);
      for (let i = 0; i < displayCount; i++) {
        const varName = variables[i];
        if (!varName) continue;
        try {
          const value = (globalThis as Record<string, unknown>)[varName];
          const typeName = Array.isArray(value)
            ? `Array(${value.length})`
            : typeof value === "object" && value !== null
              ? "Object"
              : typeof value;
          output.push(`  ${varName}: ${typeName}`);
        } catch (e) {
          output.push(`  ${varName}: ⚠️ error`);
        }
      }
      if (variables.length > 20) {
        output.push(`  ... ${variables.length - 20} more`);
      }
      output.push("\n");
    }
  }

  // 3. Explore specific keys in detail
  output.push("=== 🔍 Detailed Exploration ===\n");
  const seen = new WeakSet<object>();

  for (const key of keysToExplore) {
    const value = (globalThis as Record<string, unknown>)[key];
    if (value === undefined) {
      output.push(`${key} ∅`);
      output.push("");
      continue;
    }

    output.push(`${key} ${getTypeName(value)}`);
    exploreProp(value, key, 0, "  ", seen);
    output.push("");
  }

  return output.join("\n");
}

// Example usage - can be customized or removed
const result = exploreEnvironment({
  keysToExplore: [
    "storyCards",
    "history",
    "state",
    "info",
    "memory",
    "stop",
    "text",
  ],
  scopeFunctions: [
    "addStoryCard",
    "removeStoryCard",
    "updateStoryCard",
    "updateStoryCards",
    "updateState",
    "log",
    "deepFreeze",
  ],
  maxDepth: 3,
  maxFunctionBodyLength: 2000,
  showGlobalFunctions: true,
  showGlobalVariables: true,
  showPrototypes: false,
});
