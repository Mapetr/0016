import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { linkRatelimit, verifyTurnstileToken } from "@/convex/ratelimit";
import { generateString } from "@/convex/helpers";

// Only callable from the /shortenLink HTTP action, which derives
// `identifier` (client IP) server-side so it can't be spoofed.
export const shortenLink = internalAction({
  args: {
    url: v.string(),
    turnstileToken: v.string(),
    identifier: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (args.url.length > 256) {
      throw new Error("Invalid URL");
    }

    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL");
    }

    const isValidToken = await verifyTurnstileToken(args.turnstileToken);
    if (!isValidToken) {
      throw new Error("Bot verification failed. Please try again.");
    }

    const { success } = await linkRatelimit.limit(args.identifier);
    if (!success) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    const slug = await ctx.runMutation(internal.links.createLink, {
      url: args.url,
    });

    return { url: `${process.env.DOMAIN}/${slug}` };
  },
});

export const createLink = internalMutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Mutations are transactional, so the uniqueness check can't race.
    let slug = generateString(6);
    while (
      await ctx.db
        .query("links")
        .withIndex("bySlug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      slug = generateString(6);
    }

    await ctx.db.insert("links", { slug, url: args.url });
    return slug;
  },
});

export const getUrl = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("links")
      .withIndex("bySlug", (q) => q.eq("slug", args.slug))
      .unique();
    return link?.url ?? null;
  },
});
