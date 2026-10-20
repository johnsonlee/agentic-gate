/**
 * Reports identical static fragments in template literals, including
 * TypeScript template literal types. The second and every later occurrence is
 * reported across the whole project. A word-bearing fragment contains at
 * least one Unicode letter, mark, number, or connector punctuation character.
 * Pure punctuation and whitespace are formatting delimiters rather than
 * reusable text. Tagged-template fragments participate under the same
 * definition. Ordinary quoted string literals are outside this rule. This
 * rule has no options or thresholds.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface DuplicateTemplateLiteralFragmentContext {
  fragment: string;
  originalLocation: string;
}

/** @hidden */
export default defineProjectRule<DuplicateTemplateLiteralFragmentContext>(import.meta.url, {
  engine: "source-duplicates",
  message: (duplicate) =>
    `Template literal fragment ${JSON.stringify(duplicate.fragment)} duplicates its first occurrence in ${duplicate.originalLocation}.`,
  instruction: (duplicate) =>
    `Define ${JSON.stringify(duplicate.fragment)} once. Interpolate the shared value directly at runtime, or interpolate its typeof type from a template literal type.`
});
