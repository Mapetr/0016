import { describe, expect, test } from "vitest";
import { FileData, formatBytes, Link } from "./utils";

describe("formatBytes", () => {
  test("formats zero", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  test("uses decimal (SI) units", () => {
    expect(formatBytes(500)).toBe("500 Bytes");
    expect(formatBytes(1000)).toBe("1 KB");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(250000000)).toBe("250 MB");
    expect(formatBytes(1000000000)).toBe("1 GB");
  });

  test("respects the decimals argument", () => {
    expect(formatBytes(1555, 0)).toBe("2 KB");
    expect(formatBytes(1555, 3)).toBe("1.555 KB");
  });
});

describe("Link schema", () => {
  test("accepts valid urls", () => {
    expect(Link.safeParse({ url: "https://example.com/a" }).success).toBe(
      true
    );
  });

  test("rejects non-urls and overlong urls", () => {
    expect(Link.safeParse({ url: "not a url" }).success).toBe(false);
    expect(
      Link.safeParse({ url: `https://example.com/${"a".repeat(300)}` })
        .success
    ).toBe(false);
  });
});

describe("FileData schema", () => {
  test("accepts a valid file descriptor", () => {
    const parsed = FileData.safeParse({
      name: "test.txt",
      type: "text/plain",
      size: 123,
      save: false,
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects overlong names and missing fields", () => {
    expect(
      FileData.safeParse({
        name: "a".repeat(257),
        type: "text/plain",
        size: 123,
        save: false,
      }).success
    ).toBe(false);
    expect(FileData.safeParse({ name: "test.txt" }).success).toBe(false);
  });
});
