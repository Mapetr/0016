import { describe, expect, test } from "vitest";
import { generateString } from "./helpers";

describe("generateString", () => {
  test("returns the requested length", () => {
    expect(generateString(6)).toHaveLength(6);
    expect(generateString(8)).toHaveLength(8);
    expect(generateString(0)).toBe("");
  });

  test("only uses alphanumeric characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateString(16)).toMatch(/^[A-Za-z0-9]{16}$/);
    }
  });
});
