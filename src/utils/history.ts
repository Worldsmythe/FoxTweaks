import type { History } from "../types";

declare const history: History[] | undefined;

/**
 * Gets the last action of a specific type from history
 * @param type - The action type to search for
 * @returns The last matching action or null
 */
export function getLastActionOfType(type: string): History | null {
  if (!history || !history.length) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const action = history[i];
    if (action && action.type === type) {
      return action;
    }
  }
  return null;
}

/**
 * Gets the last action from history
 * @returns The last action or null
 */
export function getLastAction(): History | null {
  if (!history || !history.length) return null;
  return history[history.length - 1] || null;
}

/**
 * Checks if an action is of one of the specified types
 * @param action - The action to check
 * @param types - Single type or array of types to check against
 * @returns true if the action matches one of the types
 */
export function isActionType(
  action: History | null,
  types: string | string[]
): boolean {
  if (!action) return false;
  const typeArray = Array.isArray(types) ? types : [types];
  return typeArray.includes(action.type);
}
