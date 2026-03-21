import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("reminders")
      .filter((q) => q.eq(q.field("isCompleted"), false))
      .collect();
  },
});

export const list = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, args) => {
    if (!args.workspaceId) return [];
    return await ctx.db
      .query("reminders")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", args.workspaceId!),
      )
      .order("desc")
      .collect();
  },
});

export const add = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    task: v.string(),
    dueDate: v.optional(v.number()),
    recurrence: v.optional(
      v.union(
        v.literal("none"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("annually"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      task: args.task,
      isCompleted: false,
      dueDate: args.dueDate,
      recurrence: args.recurrence || "none",
      strikes: args.recurrence && args.recurrence !== "none" ? 0 : undefined,
      completedDates: [],
      lastResetAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: { id: v.id("reminders"), isCompleted: v.boolean() },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.id);
    if (!reminder) return;

    // Maintain completedDates histogram
    const today = new Date().toISOString().split("T")[0] || "";
    let dates = (reminder.completedDates as string[]) || [];

    if (args.isCompleted && !dates.includes(today)) {
      dates.push(today);
    } else if (!args.isCompleted) {
      dates = dates.filter((d) => d !== today);
    }

    await ctx.db.patch(args.id, {
      isCompleted: args.isCompleted,
      lastCompletedAt: args.isCompleted ? Date.now() : undefined,
      completedDates: dates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const editTask = mutation({
  args: {
    id: v.id("reminders"),
    task: v.string(),
    dueDate: v.optional(v.number()),
    recurrence: v.optional(
      v.union(
        v.literal("none"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("annually"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    const patch: any = {
      task: args.task,
      dueDate: args.dueDate,
      recurrence: args.recurrence,
      updatedAt: Date.now(),
    };

    // If recurrence changed, reset the strike interval starting from now
    if (existing && existing.recurrence !== args.recurrence) {
      patch.lastResetAt = Date.now();
    }

    await ctx.db.patch(args.id, patch);
  },
});

export const processDailyStrikes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Interval definitions in milliseconds
    const intervals: Record<string, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      biweekly: 14 * 24 * 60 * 60 * 1000,
      monthly: 28 * 24 * 60 * 60 * 1000,
      quarterly: 90 * 24 * 60 * 60 * 1000,
      annually: 365 * 24 * 60 * 60 * 1000,
    };

    // Process all tasks
    const allReminders = await ctx.db.query("reminders").collect();

    for (const reminder of allReminders) {
      const recurrence = (reminder.recurrence || "none") as string;
      const isOneTime = recurrence === "none";
      const intervalMs = intervals[recurrence];

      // 1. One-time tasks with Due Dates
      if (isOneTime && reminder.dueDate && now > reminder.dueDate) {
        if (!reminder.isCompleted && (reminder.strikes || 0) === 0) {
          await ctx.db.patch(reminder._id, {
            strikes: 1,
            updatedAt: now,
          });
        }
        continue; // Skip further processing for one-time
      }

      // 2. Recurring tasks (Cron Job logic)
      if (!isOneTime && intervalMs) {
        const baseTime =
          reminder.lastResetAt || (reminder as any)._creationTime;
        const timePassed = now - baseTime;

        if (timePassed >= intervalMs) {
          const patch: any = {
            isCompleted: false, // Reset for next period
            lastResetAt: now,
            updatedAt: now,
          };

          if (!reminder.isCompleted) {
            patch.strikes = (reminder.strikes || 0) + 1;
          }

          // If it has a dueDate (time cutoff), advance it by the interval
          if (reminder.dueDate) {
            patch.dueDate = reminder.dueDate + intervalMs;
          }

          await ctx.db.patch(reminder._id, patch);
        }
      }
    }
  },
});

export const testSeed = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // 1. Overdue task
    await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      task: "Overdue Financial Audit",
      isCompleted: false,
      dueDate: Date.now() - 3600000,
      recurrence: "none",
    });

    // 2. Missed recurring habit with strikes
    await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      task: "Review Codebase",
      isCompleted: false,
      recurrence: "daily",
      strikes: 2,
    });

    // 3. Completed recurring habit
    await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      task: "Check Emails",
      isCompleted: true,
      recurrence: "daily",
      strikes: 0,
      lastCompletedAt: Date.now(),
    });

    // 4. Future strict time task
    await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      task: "Meeting with Client",
      isCompleted: false,
      dueDate: Date.now() + 86400000,
      recurrence: "none",
    });
  },
});
