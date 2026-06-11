/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

describe("createLink", () => {
  test("inserts a link and returns a 6-char slug", async () => {
    const t = convexTest(schema, modules);
    const slug = await t.mutation(internal.links.createLink, {
      url: "https://example.com/some/long/path",
    });

    expect(slug).toMatch(/^[A-Za-z0-9]{6}$/);

    const url = await t.query(api.links.getUrl, { slug });
    expect(url).toBe("https://example.com/some/long/path");
  });

  test("generates distinct slugs for repeated urls", async () => {
    const t = convexTest(schema, modules);
    const slugs = await Promise.all(
      Array.from({ length: 20 }, () =>
        t.mutation(internal.links.createLink, { url: "https://example.com" })
      )
    );
    expect(new Set(slugs).size).toBe(20);
  });
});

describe("getUrl", () => {
  test("returns null for unknown slug", async () => {
    const t = convexTest(schema, modules);
    const url = await t.query(api.links.getUrl, { slug: "nosuch" });
    expect(url).toBeNull();
  });
});

function stubNetwork({ turnstileOk }: { turnstileOk: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("challenges.cloudflare.com")) {
        return new Response(JSON.stringify({ success: turnstileOk }));
      }
      if (url.includes("fake-upstash.test")) {
        // Upstash REST eval response; the sliding-window script resolves
        // to [remainingTokens, effectiveLimit]. Pipelined requests (used
        // by analytics) expect an array of results.
        if (url.includes("pipeline")) {
          return new Response(JSON.stringify([{ result: [5, 10] }]));
        }
        return new Response(JSON.stringify({ result: [5, 10] }));
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    })
  );
}

describe("shortenLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("rejects invalid urls before any network call", async () => {
    const t = convexTest(schema, modules);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch should not be called");
      })
    );

    await expect(
      t.action(internal.links.shortenLink, {
        url: "not a url",
        turnstileToken: "tok",
        identifier: "ip:1.2.3.4",
      })
    ).rejects.toThrow("Invalid URL");

    await expect(
      t.action(internal.links.shortenLink, {
        url: "javascript:alert(1)",
        turnstileToken: "tok",
        identifier: "ip:1.2.3.4",
      })
    ).rejects.toThrow("Invalid URL");

    await expect(
      t.action(internal.links.shortenLink, {
        url: `https://example.com/${"a".repeat(300)}`,
        turnstileToken: "tok",
        identifier: "ip:1.2.3.4",
      })
    ).rejects.toThrow("Invalid URL");
  });

  test("rejects when turnstile fails", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: false });

    await expect(
      t.action(internal.links.shortenLink, {
        url: "https://example.com",
        turnstileToken: "bad",
        identifier: "ip:1.2.3.4",
      })
    ).rejects.toThrow("Bot verification failed");
  });

  test("returns a short url on success", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });

    const { url } = await t.action(internal.links.shortenLink, {
      url: "https://example.com/target",
      turnstileToken: "tok",
      identifier: "ip:1.2.3.4",
    });

    const match = url.match(/^https:\/\/short\.test\/([A-Za-z0-9]{6})$/);
    expect(match).not.toBeNull();

    const stored = await t.query(api.links.getUrl, { slug: match![1] });
    expect(stored).toBe("https://example.com/target");
  });
});

describe("/shortenLink http route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns 400 on invalid JSON body", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/shortenLink", {
      method: "POST",
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });

  test("returns 400 with error message on invalid url", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });
    const res = await t.fetch("/shortenLink", {
      method: "POST",
      body: JSON.stringify({ url: "not a url", turnstileToken: "tok" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid URL");
  });

  test("returns 200 and a short url on success", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });
    const res = await t.fetch("/shortenLink", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({
        url: "https://example.com/target",
        turnstileToken: "tok",
      }),
    });
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(/^https:\/\/short\.test\/[A-Za-z0-9]{6}$/);
  });
});
