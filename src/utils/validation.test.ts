import { describe, it, expect } from "bun:test";
import {
  booleanValidator,
  stringValidator,
  numberValidator,
  enumValidator,
  arrayValidator,
  objectValidator,
} from "./validation";

describe("booleanValidator", () => {
  describe("valid boolean values", () => {
    it("should return true when value is true", () => {
      expect(booleanValidator({ enable: true }, "enable")).toBe(true);
    });

    it("should return false when value is false", () => {
      expect(booleanValidator({ enable: false }, "enable")).toBe(false);
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(booleanValidator({}, "enable")).toBe(false);
    });

    it("should return default when value is string", () => {
      expect(booleanValidator({ enable: "true" }, "enable")).toBe(false);
    });

    it("should return default when value is number", () => {
      expect(booleanValidator({ enable: 1 }, "enable")).toBe(false);
    });

    it("should return default when value is null", () => {
      expect(booleanValidator({ enable: null }, "enable")).toBe(false);
    });

    it("should return default when value is undefined", () => {
      expect(booleanValidator({ enable: undefined }, "enable")).toBe(false);
    });
  });

  describe("custom defaults", () => {
    it("should use custom default when provided", () => {
      expect(booleanValidator({}, "enable", true)).toBe(true);
    });

    it("should return valid value over custom default", () => {
      expect(booleanValidator({ enable: false }, "enable", true)).toBe(false);
    });
  });
});

describe("stringValidator", () => {
  describe("valid string values", () => {
    it("should return string value", () => {
      expect(stringValidator({ name: "test" }, "name")).toBe("test");
    });

    it("should return empty string", () => {
      expect(stringValidator({ name: "" }, "name")).toBe("");
    });

    it("should return string with spaces", () => {
      expect(stringValidator({ name: "  test  " }, "name")).toBe("  test  ");
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(stringValidator({}, "name")).toBe("");
    });

    it("should return default when value is number", () => {
      expect(stringValidator({ name: 123 }, "name")).toBe("");
    });

    it("should return default when value is boolean", () => {
      expect(stringValidator({ name: true }, "name")).toBe("");
    });

    it("should return default when value is null", () => {
      expect(stringValidator({ name: null }, "name")).toBe("");
    });

    it("should return default when value is object", () => {
      expect(stringValidator({ name: {} }, "name")).toBe("");
    });

    it("should return default when value is array", () => {
      expect(stringValidator({ name: [] }, "name")).toBe("");
    });
  });

  describe("custom defaults", () => {
    it("should use custom default when provided", () => {
      expect(stringValidator({}, "name", "default")).toBe("default");
    });

    it("should return valid value over custom default", () => {
      expect(stringValidator({ name: "actual" }, "name", "default")).toBe(
        "actual"
      );
    });
  });
});

describe("numberValidator", () => {
  describe("valid number values", () => {
    it("should return number value", () => {
      expect(numberValidator({ count: 42 }, "count")).toBe(42);
    });

    it("should return zero", () => {
      expect(numberValidator({ count: 0 }, "count")).toBe(0);
    });

    it("should return negative numbers", () => {
      expect(numberValidator({ count: -10 }, "count")).toBe(-10);
    });

    it("should return decimals", () => {
      expect(numberValidator({ count: 3.14 }, "count")).toBe(3.14);
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(numberValidator({}, "count")).toBe(0);
    });

    it("should return default when value is string", () => {
      expect(numberValidator({ count: "42" }, "count")).toBe(0);
    });

    it("should return default when value is boolean", () => {
      expect(numberValidator({ count: true }, "count")).toBe(0);
    });

    it("should return default when value is null", () => {
      expect(numberValidator({ count: null }, "count")).toBe(0);
    });

    it("should return default when value is NaN", () => {
      expect(numberValidator({ count: NaN }, "count")).toBe(0);
    });
  });

  describe("min constraint", () => {
    it("should accept value above min", () => {
      expect(numberValidator({ count: 10 }, "count", { min: 5 })).toBe(10);
    });

    it("should accept value equal to min", () => {
      expect(numberValidator({ count: 5 }, "count", { min: 5 })).toBe(5);
    });

    it("should reject value below min", () => {
      expect(numberValidator({ count: 3 }, "count", { min: 5 }, 0)).toBe(0);
    });
  });

  describe("max constraint", () => {
    it("should accept value below max", () => {
      expect(numberValidator({ count: 5 }, "count", { max: 10 })).toBe(5);
    });

    it("should accept value equal to max", () => {
      expect(numberValidator({ count: 10 }, "count", { max: 10 })).toBe(10);
    });

    it("should reject value above max", () => {
      expect(numberValidator({ count: 15 }, "count", { max: 10 }, 0)).toBe(0);
    });
  });

  describe("min and max constraints", () => {
    it("should accept value in range", () => {
      expect(numberValidator({ count: 7 }, "count", { min: 5, max: 10 })).toBe(
        7
      );
    });

    it("should accept min boundary", () => {
      expect(numberValidator({ count: 5 }, "count", { min: 5, max: 10 })).toBe(
        5
      );
    });

    it("should accept max boundary", () => {
      expect(numberValidator({ count: 10 }, "count", { min: 5, max: 10 })).toBe(
        10
      );
    });

    it("should reject value below min", () => {
      expect(
        numberValidator({ count: 3 }, "count", { min: 5, max: 10 }, 0)
      ).toBe(0);
    });

    it("should reject value above max", () => {
      expect(
        numberValidator({ count: 15 }, "count", { min: 5, max: 10 }, 0)
      ).toBe(0);
    });
  });

  describe("integer constraint", () => {
    it("should floor decimals when integer is true", () => {
      expect(numberValidator({ count: 3.7 }, "count", { integer: true })).toBe(
        3
      );
    });

    it("should preserve integers when integer is true", () => {
      expect(numberValidator({ count: 5 }, "count", { integer: true })).toBe(5);
    });

    it("should floor negative decimals", () => {
      expect(numberValidator({ count: -2.3 }, "count", { integer: true })).toBe(
        -3
      );
    });

    it("should allow decimals when integer is false", () => {
      expect(numberValidator({ count: 3.7 }, "count", { integer: false })).toBe(
        3.7
      );
    });
  });

  describe("combined constraints", () => {
    it("should apply integer then check range", () => {
      expect(
        numberValidator({ count: 5.8 }, "count", { integer: true, min: 5 })
      ).toBe(5);
    });

    it("should floor then reject if out of range", () => {
      expect(
        numberValidator({ count: 4.9 }, "count", { integer: true, min: 5 }, 0)
      ).toBe(0);
    });
  });

  describe("custom defaults", () => {
    it("should use custom default when provided", () => {
      expect(numberValidator({}, "count", {}, 100)).toBe(100);
    });

    it("should return valid value over custom default", () => {
      expect(numberValidator({ count: 42 }, "count", {}, 100)).toBe(42);
    });

    it("should use custom default when out of range", () => {
      expect(numberValidator({ count: 3 }, "count", { min: 5 }, 100)).toBe(100);
    });
  });
});

describe("enumValidator", () => {
  const colors = ["red", "green", "blue"] as const;

  describe("valid enum values", () => {
    it("should return valid enum value", () => {
      expect(enumValidator({ color: "red" }, "color", colors, "red")).toBe(
        "red"
      );
    });

    it("should accept any value in enum", () => {
      expect(enumValidator({ color: "green" }, "color", colors, "red")).toBe(
        "green"
      );
      expect(enumValidator({ color: "blue" }, "color", colors, "red")).toBe(
        "blue"
      );
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(enumValidator({}, "color", colors, "red")).toBe("red");
    });

    it("should return default when value is not in enum", () => {
      expect(enumValidator({ color: "yellow" }, "color", colors, "red")).toBe(
        "red"
      );
    });

    it("should return default when value is number", () => {
      expect(enumValidator({ color: 123 }, "color", colors, "red")).toBe("red");
    });

    it("should return default when value is boolean", () => {
      expect(enumValidator({ color: true }, "color", colors, "red")).toBe(
        "red"
      );
    });

    it("should return default when value is null", () => {
      expect(enumValidator({ color: null }, "color", colors, "red")).toBe(
        "red"
      );
    });
  });

  describe("case sensitivity", () => {
    it("should be case sensitive", () => {
      expect(enumValidator({ color: "RED" }, "color", colors, "red")).toBe(
        "red"
      );
      expect(enumValidator({ color: "Red" }, "color", colors, "red")).toBe(
        "red"
      );
    });
  });

  describe("type safety", () => {
    it("should preserve type of enum values", () => {
      type Color = (typeof colors)[number];
      const result: Color = enumValidator(
        { color: "green" },
        "color",
        colors,
        "red"
      );
      expect(result).toBe("green");
    });
  });
});

describe("arrayValidator", () => {
  describe("valid array values", () => {
    it("should return array value", () => {
      expect(arrayValidator({ items: [1, 2, 3] }, "items")).toEqual([1, 2, 3]);
    });

    it("should return empty array", () => {
      expect(arrayValidator({ items: [] }, "items")).toEqual([]);
    });

    it("should return string array", () => {
      expect(arrayValidator<string>({ items: ["a", "b"] }, "items")).toEqual([
        "a",
        "b",
      ]);
    });

    it("should return mixed type array", () => {
      expect(arrayValidator({ items: [1, "a", true] }, "items")).toEqual([
        1,
        "a",
        true,
      ]);
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(arrayValidator({}, "items")).toEqual([]);
    });

    it("should return default when value is string", () => {
      expect(arrayValidator({ items: "not array" }, "items")).toEqual([]);
    });

    it("should return default when value is number", () => {
      expect(arrayValidator({ items: 123 }, "items")).toEqual([]);
    });

    it("should return default when value is boolean", () => {
      expect(arrayValidator({ items: true }, "items")).toEqual([]);
    });

    it("should return default when value is null", () => {
      expect(arrayValidator({ items: null }, "items")).toEqual([]);
    });

    it("should return default when value is object", () => {
      expect(arrayValidator({ items: { a: 1 } }, "items")).toEqual([]);
    });
  });

  describe("custom defaults", () => {
    it("should use custom default when provided", () => {
      expect(arrayValidator<number>({}, "items", [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("should return valid value over custom default", () => {
      expect(
        arrayValidator<number>({ items: [4, 5] }, "items", [1, 2, 3])
      ).toEqual([4, 5]);
    });
  });

  describe("type safety", () => {
    it("should preserve array element types", () => {
      const result: string[] = arrayValidator<string>(
        { items: ["a", "b"] },
        "items"
      );
      expect(result).toEqual(["a", "b"]);
    });
  });
});

describe("objectValidator", () => {
  describe("valid object values", () => {
    it("should return object value", () => {
      expect(objectValidator({ data: { a: 1 } }, "data")).toEqual({ a: 1 });
    });

    it("should return empty object", () => {
      expect(objectValidator({ data: {} }, "data")).toEqual({});
    });

    it("should return nested objects", () => {
      expect(objectValidator({ data: { a: { b: 2 } } }, "data")).toEqual({
        a: { b: 2 },
      });
    });

    it("should return object with mixed types", () => {
      expect(
        objectValidator({ data: { a: 1, b: "test", c: true } }, "data")
      ).toEqual({
        a: 1,
        b: "test",
        c: true,
      });
    });
  });

  describe("invalid values", () => {
    it("should return default when value is missing", () => {
      expect(objectValidator({}, "data")).toEqual({});
    });

    it("should return default when value is string", () => {
      expect(objectValidator({ data: "not object" }, "data")).toEqual({});
    });

    it("should return default when value is number", () => {
      expect(objectValidator({ data: 123 }, "data")).toEqual({});
    });

    it("should return default when value is boolean", () => {
      expect(objectValidator({ data: true }, "data")).toEqual({});
    });

    it("should return default when value is null", () => {
      expect(objectValidator({ data: null }, "data")).toEqual({});
    });

    it("should return default when value is array", () => {
      expect(objectValidator({ data: [1, 2, 3] }, "data")).toEqual({});
    });
  });

  describe("custom defaults", () => {
    it("should use custom default when provided", () => {
      expect(objectValidator<{ x: number }>({}, "data", { x: 10 })).toEqual({
        x: 10,
      });
    });

    it("should return valid value over custom default", () => {
      expect(
        objectValidator<{ x: number }>({ data: { x: 5 } }, "data", { x: 10 })
      ).toEqual({ x: 5 });
    });
  });

  describe("type safety", () => {
    it("should preserve object shape types", () => {
      interface Config extends Record<string, unknown> {
        name: string;
        count: number;
      }
      const result: Config = objectValidator<Config>(
        { data: { name: "test", count: 42 } },
        "data",
        { name: "", count: 0 }
      );
      expect(result).toEqual({ name: "test", count: 42 });
    });
  });
});
