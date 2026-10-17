/**
 * Reports string literals used directly by comparison operators or as switch
 * cases. A comparison value represents a domain concept and must be declared
 * as a named constant before it is compared.
 *
 * Static template literals and string literals wrapped in transparent
 * TypeScript expressions are treated as hardcoded strings. Template literals
 * with substitutions are dynamic expressions and are not reported. The rule
 * has no options.
 *
 * @example
 * ```ts
 * if (status === "ready") start(); // reported
 * const READY = "ready";
 * if (status === READY) start();
 * ```
 * @module
 */

import { AstNodeTypes, JavaScriptValueTypes } from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  HARDCODED_STRING_COMPARISON:
    "A hardcoded string is used in a comparison. Define a named constant and compare against that constant."
} as const;

type NoHardcodedStringComparisonsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const transparentExpressionTypes = new Set<string>([
  AstNodeTypes.CHAIN_EXPRESSION,
  AstNodeTypes.TS_AS_EXPRESSION,
  AstNodeTypes.TS_NON_NULL_EXPRESSION,
  AstNodeTypes.TS_SATISFIES_EXPRESSION,
  AstNodeTypes.TS_TYPE_ASSERTION
]);
const comparisonOperators = new Set([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  "<=",
  ">",
  ">="
]);

function unwrap(node: Node): Node {
  let current = node;
  while (transparentExpressionTypes.has(current.type) && current.expression) {
    current = current.expression;
  }
  return current;
}

function hardcodedString(node: Node | null | undefined): Node | undefined {
  if (!node) return undefined;
  const value = unwrap(node);
  if (
    value.type === AstNodeTypes.LITERAL &&
    typeof value.value === JavaScriptValueTypes.STRING
  ) return value;
  if (value.type === AstNodeTypes.TEMPLATE_LITERAL && value.expressions.length === 0) return value;
  return undefined;
}

/** @hidden */
export default defineRule<NoHardcodedStringComparisonsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Require named constants for strings used in comparisons."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    function report(node: Node | undefined): void {
      if (!node) return;
      context.report({ node, messageId: "HARDCODED_STRING_COMPARISON" });
    }

    return {
      BinaryExpression(node) {
        if (!comparisonOperators.has(node.operator)) return;
        report(hardcodedString(node.left as Node));
        report(hardcodedString(node.right as Node));
      },
      SwitchCase(node) {
        report(hardcodedString(node.test as Node | null));
      }
    };
  }
});
