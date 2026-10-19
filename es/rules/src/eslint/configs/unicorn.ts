import type { Linter } from "eslint";
import unicorn from "eslint-plugin-unicorn";

/**
 * Correctness rules imported from Unicorn 78. Suggestion rules and rules that
 * infer developer intent are excluded. Every listed rule is promoted to error
 * severity by the gate preset.
 *
 * | Category | Rule |
 * | --- | --- |
 * | Logic and runtime behavior | `unicorn/no-accessor-recursion` |
 * | Logic and runtime behavior | `unicorn/no-async-iterator-callback` |
 * | Logic and runtime behavior | `unicorn/no-boolean-sort-comparator` |
 * | Logic and runtime behavior | `unicorn/no-chained-comparison` |
 * | Logic and runtime behavior | `unicorn/no-conflicting-constraints` |
 * | Logic and runtime behavior | `unicorn/no-constant-zero-expression` |
 * | Logic and runtime behavior | `unicorn/no-duplicate-logical-operands` |
 * | Logic and runtime behavior | `unicorn/no-impossible-length-comparison` |
 * | Logic and runtime behavior | `unicorn/no-incomplete-accessor-override` |
 * | Logic and runtime behavior | `unicorn/no-instanceof-builtins` |
 * | Logic and runtime behavior | `unicorn/no-misrefactored-assignment` |
 * | Logic and runtime behavior | `unicorn/no-multiple-promise-resolver-calls` |
 * | API contracts | `unicorn/no-invalid-argument-count` |
 * | API contracts | `unicorn/no-invalid-boolean-attribute-value` |
 * | API contracts | `unicorn/no-invalid-character-comparison` |
 * | API contracts | `unicorn/no-invalid-dom-token` |
 * | API contracts | `unicorn/no-invalid-fetch-options` |
 * | API contracts | `unicorn/no-invalid-integrity` |
 * | API contracts | `unicorn/no-invalid-intl-options` |
 * | API contracts | `unicorn/no-invalid-property-descriptor` |
 * | API contracts | `unicorn/no-invalid-remove-event-listener` |
 * | API contracts | `unicorn/no-invalid-response-options` |
 * | API contracts | `unicorn/no-invalid-style-set-property` |
 * | API contracts | `unicorn/no-invalid-temporal-arithmetic` |
 * | API contracts | `unicorn/no-invalid-url-protocol-comparison` |
 * | API contracts | `unicorn/no-invalid-well-known-symbol-methods` |
 * | API contracts | `unicorn/no-prevent-default-in-passive-listener` |
 * | Safety and discarded results | `unicorn/no-shorthand-property-overrides` |
 * | Safety and discarded results | `unicorn/no-unsafe-buffer-conversion` |
 * | Safety and discarded results | `unicorn/no-unsafe-promise-all-settled-values` |
 * | Safety and discarded results | `unicorn/no-unsafe-sqlite-interpolation` |
 * | Safety and discarded results | `unicorn/no-unused-iterator-helper` |
 */
const curatedUnicornRuleNames = [
  "no-accessor-recursion",
  "no-async-iterator-callback",
  "no-boolean-sort-comparator",
  "no-chained-comparison",
  "no-conflicting-constraints",
  "no-constant-zero-expression",
  "no-duplicate-logical-operands",
  "no-impossible-length-comparison",
  "no-incomplete-accessor-override",
  "no-instanceof-builtins",
  "no-invalid-argument-count",
  "no-invalid-boolean-attribute-value",
  "no-invalid-character-comparison",
  "no-invalid-dom-token",
  "no-invalid-fetch-options",
  "no-invalid-integrity",
  "no-invalid-intl-options",
  "no-invalid-property-descriptor",
  "no-invalid-remove-event-listener",
  "no-invalid-response-options",
  "no-invalid-style-set-property",
  "no-invalid-temporal-arithmetic",
  "no-invalid-url-protocol-comparison",
  "no-invalid-well-known-symbol-methods",
  "no-misrefactored-assignment",
  "no-multiple-promise-resolver-calls",
  "no-prevent-default-in-passive-listener",
  "no-shorthand-property-overrides",
  "no-unsafe-buffer-conversion",
  "no-unsafe-promise-all-settled-values",
  "no-unsafe-sqlite-interpolation",
  "no-unused-iterator-helper"
] as const;

function unicornRuleRegistry() {
  if (!unicorn.rules) throw new Error("Unicorn does not expose its rule registry.");
  return unicorn.rules;
}

const unicornRules = unicornRuleRegistry();

function fixedRuleConfiguration(
  name: typeof curatedUnicornRuleNames[number]
): Linter.RuleEntry {
  const rule = unicornRules[name];
  if (!rule) throw new Error(`Unicorn rule '${name}' is unavailable.`);
  return ["error", ...(rule.meta?.defaultOptions ?? [])];
}

/** ESLint flat-config layer that enables the curated Unicorn gate. */
export const curatedUnicornConfig: Linter.Config = {
  name: "agentic-gate/unicorn-curated",
  plugins: {
    unicorn
  },
  rules: Object.fromEntries(
    curatedUnicornRuleNames.map((name) => [
      `unicorn/${name}`,
      fixedRuleConfiguration(name)
    ])
  )
};
