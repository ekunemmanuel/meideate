import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    fileId: v.id("_storage"),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      ...args,
    });
  },
});

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("documents")
      .withIndex("by_workspace", q => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
      
    return Promise.all(docs.map(async (doc) => ({
      ...doc,
      url: await ctx.storage.getUrl(doc.fileId),
    })));
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    
    await ctx.storage.delete(doc.fileId);
    await ctx.db.delete(args.id);
  },
});
