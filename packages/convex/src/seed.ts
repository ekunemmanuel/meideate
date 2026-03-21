import { mutation } from "./_generated/server";

export const seed = mutation({
  handler: async (ctx) => {
    // Check if we already have workspaces to avoid duplicates
    const existing = await ctx.db.query("workspaces").first();
    if (existing) return "Already seeded";

    await ctx.db.insert("workspaces", {
      name: "✨ Welcome to Meideate",
      content: `# Welcome to Meideate\n\nMeideate is your personal space where you get to write your **thoughts**, your **ideas**, and all your **actionable plans** to achieve what you want. \n\nIt's similar to how you write everything that you want to achieve in a book, but instead of that, you **digitize it**.\n\n### Moving the Needle Forward\nUse this space to:\n- 🧠 Capture fleeting thoughts before they disappear\n- 💡 Refine raw ideas into clear concepts\n- ✅ Create actionable plans to reach your goals\n- 🎙️ Add voice notes and meeting summaries (Coming Soon)\n\nEverything here is designed to make you **much more productive** and help you **move the needle forward**.\n\n### My Voice Notes\n::audio{src="https://kindly-lapwing-432.convex.cloud/api/storage/c24af9c4-0526-4eec-8273-c1f8bce1cf12"}\n\n### Video Demo\n::video{src="https://kindly-lapwing-432.convex.cloud/api/storage/ea7aa450-a3d4-4ad1-b597-85eb9e2a97cd"}`,
      createdAt: Date.now(),
    });

    return "Seed successful";
  },
});
