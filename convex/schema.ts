import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    externalId: v.string()
  }).index("byExternalId", ["externalId"]),
  files: defineTable({
    url: v.string(),
    size: v.number(),
    type: v.string(),
    userId: v.id("users")
  })
});