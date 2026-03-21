import { defineTable } from "convex/server";
import { v } from "convex/values";

export const reminders = defineTable({
  workspaceId: v.id("workspaces"),
  task: v.string(),
  isCompleted: v.boolean(),
  dueDate: v.optional(v.number()),
  recurrence: v.optional(v.union(
    v.literal("none"), 
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
    v.literal("quarterly"),
    v.literal("annually")
  )),
  strikes: v.optional(v.number()),
  lastCompletedAt: v.optional(v.number()),
  lastResetAt: v.optional(v.number()),
  completedDates: v.optional(v.array(v.string())),
  updatedAt: v.optional(v.number()),
})
  .index("by_workspaceId", ["workspaceId"]);
