import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workspaces").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      content: args.content,
      description: args.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return workspaceId;
  },
});

export const remove = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.id);
    if (!workspace) throw new Error("Workspace not found");
    const files = workspace.files ?? [];
    for (const file of files) {
      await ctx.storage.delete(file);
    }
    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const trackFile = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    
    const files = workspace.files ?? [];
    if (!files.includes(args.storageId)) {
      await ctx.db.patch(args.workspaceId, {
        files: [...files, args.storageId],
        updatedAt: Date.now(),
      });
    }
  },
});

export const cleanupUnreferencedFiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    
    // Regex matching any Convex storage URL
    const urlRegex = /https:\/\/[a-zA-Z0-9.-]+\.convex\.cloud\/api\/storage\/[a-zA-Z0-9-]+/g;
    
    for (const workspace of workspaces) {
      if (!workspace.files || workspace.files.length === 0) continue;
      
      const content = workspace.content || "";
      // Pass over the text once and extract ALL URLs into a Set for O(1) lookups
      const foundUrls = new Set(content.match(urlRegex) || []);
      const validFiles = [];
      
      for (const storageId of workspace.files) {
        try {
          const url = await ctx.storage.getUrl(storageId);
          if (!url) continue;
          
          if (foundUrls.has(url)) {
            validFiles.push(storageId);
          } else {
            // Unreferenced file: GC it
            await ctx.storage.delete(storageId);
          }
        } catch (err) {
          console.error(`[GC] Error processing storageId ${storageId}:`, err);
          // Keep it if there was an error to be safe
          validFiles.push(storageId);
        }
      }
      
      if (validFiles.length !== workspace.files.length) {
        await ctx.db.patch(workspace._id, { files: validFiles });
      }
    }
  },
});
