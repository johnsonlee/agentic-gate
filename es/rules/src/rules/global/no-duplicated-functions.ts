/**
 * Reports functions with structurally identical implementations within one
 * file or across project files. The declared function name is excluded from
 * the comparison, so differently named declarations, methods, function
 * expressions, and arrow functions still duplicate one another when their
 * complete implementations match. This rule has no options.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface DuplicateFunctionContext {
  label: string;
  originalLabel: string;
  originalLocation: string;
}

/** @hidden */
export default defineProjectRule<DuplicateFunctionContext>(import.meta.url, {
  engine: "source-duplicates",
  message: (duplicate) =>
    `Function '${duplicate.label}' has the same implementation as '${duplicate.originalLabel}' declared at ${duplicate.originalLocation}.`,
  instruction: (duplicate) =>
    `Keep one implementation and reuse it instead of '${duplicate.label}'.`
});
