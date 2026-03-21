import { defineTable } from "convex/server";
import { v } from "convex/values";

export const documents = defineTable({
  workspaceId: v.id("workspaces"),
  name: v.string(),
  fileId: v.id("_storage"),
  type: v.string(),
  size: v.number(),
}).index("by_workspace", ["workspaceId"]);
