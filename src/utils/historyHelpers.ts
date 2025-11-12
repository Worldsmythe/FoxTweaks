export function findLastHistoryAction(types: string[]): History | undefined {
  if (!history) return undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    const action = history[i];
    if (action && types.includes(action.type)) {
      return action;
    }
  }
  return undefined;
}

export function findHistoryAction(
  predicate: (action: History) => boolean
): History | undefined {
  if (!history) return undefined;

  for (let i = 0; i < history.length; i++) {
    const action = history[i];
    if (action && predicate(action)) {
      return action;
    }
  }
  return undefined;
}

export function findLastHistoryIndex(
  predicate: (action: History) => boolean
): number {
  if (!history) return -1;

  for (let i = history.length - 1; i >= 0; i--) {
    const action = history[i];
    if (action && predicate(action)) {
      return i;
    }
  }
  return -1;
}

export function getLastAction(): History | undefined {
  if (!history || history.length === 0) return undefined;
  return history[history.length - 1];
}

export function getActionCount(): number {
  if (!history) return 0;
  return history.length;
}

export function getLastActionOfType(type: string): History | undefined {
  if (!history) return undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    const action = history[i];
    if (action && action.type === type) {
      return action;
    }
  }
  return undefined;
}

export function isActionType(
  action: History | null | undefined,
  types: string | string[]
): boolean {
  if (!action) return false;
  const typeArray = Array.isArray(types) ? types : [types];
  return typeArray.includes(action.type);
}

export function getRecentActions(count: number, types?: string[]): History[] {
  if (!history) return [];

  const result: History[] = [];
  for (let i = history.length - 1; i >= 0 && result.length < count; i--) {
    const action = history[i];
    if (action && (!types || types.includes(action.type))) {
      result.push(action);
    }
  }
  return result;
}

export function hasRecentActionOfType(
  type: string,
  withinCount: number
): boolean {
  if (!history) return false;

  const searchCount = Math.min(withinCount, history.length);
  for (let i = history.length - 1; i >= history.length - searchCount; i--) {
    const action = history[i];
    if (action && action.type === type) {
      return true;
    }
  }
  return false;
}
