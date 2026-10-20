/**
 * Reports source files that cannot be reached from any configured project
 * entry point.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

/** @hidden */
export default defineProjectRule(import.meta.url, {
  engine: "knip",
  message: () => "This file is unreachable from the configured project entry points.",
  instruction: () => "Remove this file or connect it to a project entry point."
});
