import { defineSchema } from "convex/server";
import { workspaces } from "./tables/workspaces";
import { documents } from "./tables/documents";
import { reminders } from "./tables/reminders";

export default defineSchema({
  workspaces,
  documents,
  reminders,
});
