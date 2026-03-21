import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "cleanup unreferenced workspace files",
  { hourUTC: 6, minuteUTC: 0 }, // Run every day at 6:00 AM UTC
  internal.workspaces.cleanupUnreferencedFiles
);

crons.daily(
  "process reminder strikes",
  { hourUTC: 6, minuteUTC: 0 },
  internal.reminders.processDailyStrikes
);

export default crons;
