/**
 * Debug logging configuration
 * Set DEBUG to false to strip all debug code at build time via tree-shaking
 *
 * Usage:
 *   import { DEBUG } from "./debug" with { type: "macro" };
 *   if (DEBUG()) {
 *     log("debug message");
 *   }
 */

export function DEBUG(): boolean {
  return false;
}
