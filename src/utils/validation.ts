import { parseBool } from "./string";

/**
 * Validates and extracts a boolean value from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param defaultValue - Default value if validation fails
 * @returns Validated boolean value
 */
export function booleanValidator(
  raw: Record<string, unknown>,
  key: string,
  defaultValue = false
): boolean {
  const value = raw[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return parseBool(value);
  }
  return defaultValue;
}

/**
 * Validates and extracts a string value from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param defaultValue - Default value if validation fails
 * @returns Validated string value
 */
export function stringValidator(
  raw: Record<string, unknown>,
  key: string,
  defaultValue = ""
): string {
  return typeof raw[key] === "string" ? raw[key] : defaultValue;
}

/**
 * Validates and extracts a number value from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param options - Validation options (min, max, integer)
 * @param defaultValue - Default value if validation fails
 * @returns Validated number value
 */
export function numberValidator(
  raw: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
  defaultValue = 0
): number {
  let value: number;

  if (typeof raw[key] === "number") {
    value = raw[key] as number;
  } else if (typeof raw[key] === "string") {
    value = options.integer ? parseInt(raw[key] as string, 10) : parseFloat(raw[key] as string);
  } else {
    return defaultValue;
  }

  if (Number.isNaN(value)) {
    return defaultValue;
  }

  if (options.integer) {
    value = Math.floor(value);
  }

  if (options.min !== undefined && value < options.min) {
    return defaultValue;
  }

  if (options.max !== undefined && value > options.max) {
    return defaultValue;
  }

  return value;
}

/**
 * Validates and extracts an enum value from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param validValues - Array of valid enum values
 * @param defaultValue - Default value if validation fails
 * @returns Validated enum value
 */
export function enumValidator<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  validValues: readonly T[],
  defaultValue: T
): T {
  const value = raw[key];
  if (typeof value === "string" && validValues.includes(value as T)) {
    return value as T;
  }
  return defaultValue;
}

/**
 * Validates and extracts an array from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param defaultValue - Default value if validation fails
 * @returns Validated array value
 */
export function arrayValidator<T>(
  raw: Record<string, unknown>,
  key: string,
  defaultValue: T[] = []
): T[] {
  const value = raw[key];

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    if (value.includes(",")) {
      return value.split(",").map((s) => s.trim()).filter(Boolean) as T[];
    } else {
      return value.split(/\s+/).filter(Boolean) as T[];
    }
  }

  return defaultValue;
}

/**
 * Validates and extracts an object from raw config
 * @param raw - Raw config object
 * @param key - Property key to extract
 * @param defaultValue - Default value if validation fails
 * @returns Validated object value
 */
export function objectValidator<T extends Record<string, unknown>>(
  raw: Record<string, unknown>,
  key: string,
  defaultValue: T = {} as T
): T {
  const value = raw[key];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as T;
  }
  return defaultValue;
}
