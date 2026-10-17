/**
 * Reports a top-level constant when the same directory module already defines
 * the same binding path with the same primitive type and exact value. The
 * binding path is part of the comparison unit: `const A = 1` duplicates
 * another `const A = 1`, while `const B = 1` expresses a different contract
 * and is not assumed equivalent. Every top-level scalar `const` declaration
 * and static field in an `as const` object participates. Function-local
 * constants and ordinary object fields do not.
 *
 * For this rule, one source directory is one module. Parent, child, and
 * sibling directories have independent constant indexes, even when they
 * belong to the same package. The rule never reads `package.json` to determine
 * the module boundary. This rule has no options.
 *
 * @example
 * ```ts
 * // first.ts
 * export const OBJECT_TYPE = "object";
 * // second.ts
 * export const OBJECT_TYPE = "object"; // reported
 * ```
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface DuplicateConstantInModuleContext {
  label: string;
  originalLabel: string;
  originalLocation: string;
}

/** @hidden */
export default defineProjectRule<DuplicateConstantInModuleContext>(import.meta.url, {
  engine: "source-duplicates",
  message: (duplicate) =>
    `Constant '${duplicate.label}' repeats the same binding and exact primitive value in this module at ${duplicate.originalLocation}.`,
  instruction: (duplicate) =>
    `Reuse '${duplicate.originalLabel}' and delete the redundant constant '${duplicate.label}'.`
});
