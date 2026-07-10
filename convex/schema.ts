import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    externalId: v.string(),
    // Synced from Clerk publicMetadata.unlimitedUploads via the users webhook.
    // When true, the per-file upload size limit does not apply.
    unlimitedUploads: v.optional(v.boolean())
  }).index("byExternalId", ["externalId"]),
  files: defineTable({
    url: v.string(),
    size: v.number(),
    type: v.string(),
    userId: v.id("users"),
    pending: v.optional(v.boolean()),
    // When true the file is published to the public collage site (Glypho).
    public: v.optional(v.boolean())
  })
    .index("byUserId", ["userId"])
    .index("byPublic", ["public"]),
  links: defineTable({
    slug: v.string(),
    url: v.string()
  }).index("bySlug", ["slug"])
});