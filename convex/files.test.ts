/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { UserJSON } from "@clerk/backend";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const identity = { subject: "clerk_user_1" };

const paginate = { paginationOpts: { numItems: 100, cursor: null } };

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

async function createUser(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: identity.subject,
      first_name: "Test",
      last_name: "User",
    } as UserJSON,
  });
}

const validArgs = {
  name: "test.txt",
  type: "text/plain",
  size: 1000,
  save: false,
  public: false,
  turnstileToken: "tok",
  identifier: "ip:1.2.3.4",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMaxSize", () => {
  test("returns the default when MAX_SIZE is unset", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.files.getMaxSize, {})).toBe(250000000);
  });

  test("honors the MAX_SIZE env var", async () => {
    vi.stubEnv("MAX_SIZE", "1234");
    const t = convexTest(schema, modules);
    expect(await t.query(api.files.getMaxSize, {})).toBe(1234);
    vi.stubEnv("MAX_SIZE", "");
  });
});

describe("getFiles", () => {
  test("returns empty for unauthenticated users", async () => {
    const t = convexTest(schema, modules);
    expect((await t.query(api.files.getFiles, paginate)).page).toEqual([]);
  });

  test("hides pending files until confirmed", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const fileId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/test.txt",
      type: "text/plain",
      size: 1000,
    });

    expect((await asUser.query(api.files.getFiles, paginate)).page).toEqual([]);

    await asUser.mutation(api.files.confirmUpload, { fileId });

    const files = (await asUser.query(api.files.getFiles, paginate)).page;
    expect(files).toHaveLength(1);
    expect(files[0].url).toBe("https://files.test/abc/test.txt");
    expect(files[0].pending).toBe(false);
  });
});

describe("getUploadUrl", () => {
  test("rejects invalid file names", async () => {
    const t = convexTest(schema, modules);
    for (const name of ["", ".", "..", "a".repeat(257)]) {
      await expect(
        t.action(internal.files.getUploadUrl, { ...validArgs, name })
      ).rejects.toThrow("Invalid file name");
    }
  });

  test("rejects overlong file types", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(internal.files.getUploadUrl, {
        ...validArgs,
        type: "a".repeat(257),
      })
    ).rejects.toThrow("Invalid file type");
  });

  test("rejects save without an account", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(internal.files.getUploadUrl, { ...validArgs, save: true })
    ).rejects.toThrow("Saving a file to account without an account");
  });

  test("rejects when turnstile fails", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: false });
    await expect(
      t.action(internal.files.getUploadUrl, validArgs)
    ).rejects.toThrow("Bot verification failed");
  });

  test("rejects invalid and oversized files", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });

    for (const size of [0, -1, 1.5]) {
      await expect(
        t.action(internal.files.getUploadUrl, { ...validArgs, size })
      ).rejects.toThrow("Invalid file size");
    }

    await expect(
      t.action(internal.files.getUploadUrl, {
        ...validArgs,
        size: 250000001,
      })
    ).rejects.toThrow("File is too big");
  });

  test("returns a presigned url and no fileId for anonymous uploads", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });

    const { url, fileId } = await t.action(
      internal.files.getUploadUrl,
      validArgs
    );

    expect(fileId).toBeNull();
    const parsed = new URL(url);
    expect(parsed.pathname).toMatch(/\/[A-Za-z0-9]{8}\/test\.txt$/);
    expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });

  test("neutralizes path separators in file names", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });

    const { url } = await t.action(internal.files.getUploadUrl, {
      ...validArgs,
      name: "../../etc/passwd",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).not.toContain("../");
    expect(parsed.pathname).toMatch(/\/\.\._\.\._etc_passwd$/);
  });

  test("inserts a pending row when saving to an account", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    stubNetwork({ turnstileOk: true });
    const asUser = t.withIdentity(identity);

    const { url, fileId } = await asUser.action(internal.files.getUploadUrl, {
      ...validArgs,
      save: true,
    });

    expect(fileId).not.toBeNull();
    expect((await asUser.query(api.files.getFiles, paginate)).page).toEqual([]);

    await asUser.mutation(api.files.confirmUpload, { fileId: fileId! });
    const files = (await asUser.query(api.files.getFiles, paginate)).page;
    expect(files).toHaveLength(1);
    expect(files[0].url).toBe(
      `${process.env.DESTINATION_URL}${new URL(url).pathname}`
    );
  });
});

describe("getPublicFiles", () => {
  test("rejects publishing without saving to account", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);
    await expect(
      asUser.action(internal.files.getUploadUrl, {
        ...validArgs,
        save: false,
        public: true,
      })
    ).rejects.toThrow("Cannot publish to the site without saving to account");
  });

  test("shows only confirmed public files with author names", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const publicId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/public.gif",
      type: "image/gif",
      size: 1000,
      public: true,
    });
    // Private file — must never appear in the public feed
    const privateId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/private.png",
      type: "image/png",
      size: 1000,
    });
    await asUser.mutation(api.files.confirmUpload, { fileId: privateId });

    // Still pending — hidden from the public feed
    expect((await t.query(api.files.getPublicFiles, paginate)).page).toEqual(
      []
    );

    await asUser.mutation(api.files.confirmUpload, { fileId: publicId });

    const page = (await t.query(api.files.getPublicFiles, paginate)).page;
    expect(page).toHaveLength(1);
    expect(page[0].url).toBe("https://files.test/abc/public.gif");
    expect(page[0].author).toBe("Test User");
  });
});

describe("confirmUpload", () => {
  test("rejects confirming someone else's file", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const fileId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/test.txt",
      type: "text/plain",
      size: 1000,
    });

    await t.mutation(internal.users.upsertFromClerk, {
      data: { id: "clerk_user_2", first_name: "Other", last_name: "User" } as UserJSON,
    });
    const asOther = t.withIdentity({ subject: "clerk_user_2" });

    await expect(
      asOther.mutation(api.files.confirmUpload, { fileId })
    ).rejects.toThrow("File not found");
  });
});

describe("deleteIfPending", () => {
  test("deletes pending rows and keeps confirmed ones", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const pendingId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/pending.txt",
      type: "text/plain",
      size: 1000,
    });
    const confirmedId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/confirmed.txt",
      type: "text/plain",
      size: 1000,
    });
    await asUser.mutation(api.files.confirmUpload, { fileId: confirmedId });

    await t.mutation(internal.files.deleteIfPending, { fileId: pendingId });
    await t.mutation(internal.files.deleteIfPending, { fileId: confirmedId });

    const files = (await asUser.query(api.files.getFiles, paginate)).page;
    expect(files).toHaveLength(1);
    expect(files[0].url).toBe("https://files.test/abc/confirmed.txt");
  });
});

describe("deleteFile", () => {
  test("removes the owner's file from their list", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const fileId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/test.txt",
      type: "text/plain",
      size: 1000,
    });
    await asUser.mutation(api.files.confirmUpload, { fileId });

    expect((await asUser.query(api.files.getFiles, paginate)).page).toHaveLength(
      1
    );

    await asUser.mutation(api.files.deleteFile, { fileId });

    expect((await asUser.query(api.files.getFiles, paginate)).page).toEqual([]);
  });

  test("rejects deleting someone else's file", async () => {
    const t = convexTest(schema, modules);
    await createUser(t);
    const asUser = t.withIdentity(identity);

    const fileId = await asUser.mutation(internal.files.saveFile, {
      url: "https://files.test/abc/test.txt",
      type: "text/plain",
      size: 1000,
    });

    await t.mutation(internal.users.upsertFromClerk, {
      data: { id: "clerk_user_2", first_name: "Other", last_name: "User" } as UserJSON,
    });
    const asOther = t.withIdentity({ subject: "clerk_user_2" });

    await expect(
      asOther.mutation(api.files.deleteFile, { fileId })
    ).rejects.toThrow("File not found");

    // Untouched for the owner
    await asUser.mutation(api.files.confirmUpload, { fileId });
    expect((await asUser.query(api.files.getFiles, paginate)).page).toHaveLength(
      1
    );
  });
});

describe("/getUploadUrl http route", () => {
  test("returns 400 on invalid JSON body", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/getUploadUrl", {
      method: "POST",
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });

  test("returns 400 when turnstile fails", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: false });
    const res = await t.fetch("/getUploadUrl", {
      method: "POST",
      body: JSON.stringify(validArgs),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Bot verification failed");
  });

  test("returns 200 with a presigned url for anonymous uploads", async () => {
    const t = convexTest(schema, modules);
    stubNetwork({ turnstileOk: true });
    const res = await t.fetch("/getUploadUrl", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify(validArgs),
    });
    expect(res.status).toBe(200);
    const { url, fileId } = await res.json();
    expect(fileId).toBeNull();
    expect(new URL(url).pathname).toMatch(/\/[A-Za-z0-9]{8}\/test\.txt$/);
  });
});
