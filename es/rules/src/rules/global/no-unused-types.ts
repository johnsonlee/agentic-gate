/**
 * Reports exported TypeScript types that are never consumed through the
 * project graph or a public entry point.
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
  message: (context) => unusedMessage("type", context),
  instruction: removeOrExpose
});
