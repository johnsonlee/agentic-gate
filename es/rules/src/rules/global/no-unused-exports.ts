/**
 * Reports values exported by a reachable module but never consumed through
 * the project graph or a public entry point.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";
import {
  removeOrExpose,
  type UnusedSymbolContext,
  unusedMessage
} from "./unused.ts";

/** @hidden */
export default defineProjectRule<UnusedSymbolContext>(import.meta.url, {
  engine: "knip",
  message: (context) => unusedMessage("export", context),
  instruction: removeOrExpose
});
