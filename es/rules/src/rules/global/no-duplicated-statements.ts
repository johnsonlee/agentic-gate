/**
 * Reports structurally identical top-level statements within one file or
 * across project files. The comparison covers complete statements and retains
 * declaration identifiers, so `const A = 1` duplicates another `const A = 1`
 * but not `const B = 1`. Function declarations and declarations initialized
 * with a function are handled by `no-duplicated-functions`. This rule has no
 * options.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface DuplicateStatementContext {
  label: string;
  originalLabel: string;
  originalLocation: string;
}

/** @hidden */
export default defineProjectRule<DuplicateStatementContext>(import.meta.url, {
  engine: "source-duplicates",
  message: (duplicate) =>
    `Top-level statement '${duplicate.label}' repeats statement '${duplicate.originalLabel}' first seen at ${duplicate.originalLocation}.`,
  instruction: (duplicate) =>
    `Keep one statement and reuse its result instead of '${duplicate.label}'.`
});
