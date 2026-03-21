import { defineTable } from "convex/server";
import { v } from "convex/values";

export const workspaces = defineTable({
  name: v.string(),
  content: v.optional(v.string()), // Rich text content (Markdown)
  description: v.optional(v.string()),
  ownerId: v.optional(v.string()), // Optional for now if we don't have auth fully wired
  files: v.optional(v.array(v.id("_storage"))),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});
