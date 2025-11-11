/**
 * Escapes special regex characters in a string
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a boolean value from a string
 * @param value - The string value to parse
 * @returns true if the value represents a truthy boolean
 */
export function parseBool(value: string): boolean {
  const v = value.toLowerCase();
  return ["true", "t", "yes", "y", "on", "1"].includes(v);
}
