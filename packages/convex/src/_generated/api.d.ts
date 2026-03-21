/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as files from "../files.js";
import type * as react from "../react.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as tables_documents from "../tables/documents.js";
import type * as tables_reminders from "../tables/reminders.js";
import type * as tables_workspaces from "../tables/workspaces.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  documents: typeof documents;
  files: typeof files;
  react: typeof react;
  reminders: typeof reminders;
  seed: typeof seed;
  "tables/documents": typeof tables_documents;
  "tables/reminders": typeof tables_reminders;
  "tables/workspaces": typeof tables_workspaces;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
