/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { UserJSON } from "@clerk/backend";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

const clerkUser = (overrides: Partial<UserJSON> = {}) =>
  ({
    id: "clerk_user_1",
    first_name: "Test",
    last_name: "User",
    ...overrides,
  }) as UserJSON;

describe("current", () => {
  test("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.current, {})).toBeNull();
  });

  test("returns the user matching the identity subject", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.upsertFromClerk, { data: clerkUser() });

    const user = await t
      .withIdentity({ subject: "clerk_user_1" })
      .query(api.users.current, {});
    expect(user?.name).toBe("Test User");
    expect(user?.externalId).toBe("clerk_user_1");
  });
});

describe("upsertFromClerk", () => {
  test("updates the existing user instead of inserting a duplicate", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.upsertFromClerk, { data: clerkUser() });
    await t.mutation(internal.users.upsertFromClerk, {
      data: clerkUser({ first_name: "Renamed" }),
    });

    const user = await t
      .withIdentity({ subject: "clerk_user_1" })
      .query(api.users.current, {});
    expect(user?.name).toBe("Renamed User");
  });
});

describe("deleteFromClerk", () => {
  test("deletes the user for the given clerk id", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.upsertFromClerk, { data: clerkUser() });
    await t.mutation(internal.users.deleteFromClerk, {
      clerkUserId: "clerk_user_1",
    });

    const user = await t
      .withIdentity({ subject: "clerk_user_1" })
      .query(api.users.current, {});
    expect(user).toBeNull();
  });

  test("is a no-op for unknown clerk ids", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.users.deleteFromClerk, { clerkUserId: "nope" })
    ).resolves.toBeNull();
  });
});
