/**
 * Reports array literals containing two or more static strings when `join`
 * also has a statically known separator. In that form the complete result is
 * already fixed by the source, so constructing it through an intermediate
 * array hides a constant string behind runtime operations. This rule has no
 * options.
 *
 * String literals and template literals without expressions are static.
 * Arrays containing holes, spreads, or runtime expressions are outside the
 * rule because their joined result is not proven solely by this syntax.
 *
 * @example
 * ```ts
 * const invalid = ["agentic", "gate"].join("-");
 * const valid = "agentic-gate";
 * const dynamic = [prefix, "gate"].join("-");
 * ```
 * @module
 */

import {
  AstNodeTypes,
  JavaScriptValueTypes
} from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  JOINED_STRING_LITERALS:
    "This join constructs a statically known string from string literals. Replace it with one string literal or a named string constant."
} as const;

type NoJoinedStringLiteralsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const JOIN_METHOD = "join";
const MINIMUM_JOINED_STRING_COUNT = 2;
const transparentExpressionTypes = new Set([
  AstNodeTypes.CHAIN_EXPRESSION,
  AstNodeTypes.TS_AS_EXPRESSION,
  AstNodeTypes.TS_NON_NULL_EXPRESSION,
  AstNodeTypes.TS_SATISFIES_EXPRESSION,
  AstNodeTypes.TS_TYPE_ASSERTION
]);

function unwrapExpression(node: Node | null | undefined): Node | undefined {
  let current = node ?? undefined;
  while (current && transparentExpressionTypes.has(current.type as never)) {
    current = current.expression;
  }
  return current;
}

function staticStringValue(node: Node | null | undefined): string | undefined {
  const value = unwrapExpression(node);
  if (!value) return undefined;
  if (
    value.type === AstNodeTypes.LITERAL &&
    typeof value.value === JavaScriptValueTypes.STRING
  ) return value.value;
  if (value.type === AstNodeTypes.TEMPLATE_LITERAL && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw;
  }
  return undefined;
}

function joinMethod(member: Node): boolean {
  if (member.type !== AstNodeTypes.MEMBER_EXPRESSION) return false;
  if (!member.computed) {
    return member.property?.type === AstNodeTypes.IDENTIFIER &&
      member.property.name === JOIN_METHOD;
  }
  return staticStringValue(member.property) === JOIN_METHOD;
}

function joinsOnlyStaticStrings(call: Node): boolean {
  if (call.callee?.type !== AstNodeTypes.MEMBER_EXPRESSION || !joinMethod(call.callee)) {
    return false;
  }
  const array = unwrapExpression(call.callee.object);
  if (
    array?.type !== AstNodeTypes.ARRAY_EXPRESSION ||
    array.elements.length < MINIMUM_JOINED_STRING_COUNT ||
    !array.elements.every((element: Node | null) => staticStringValue(element) !== undefined)
  ) return false;
  return call.arguments.length === 0 ||
    (call.arguments.length === 1 && staticStringValue(call.arguments[0]) !== undefined);
}

/** @hidden */
export default defineRule<NoJoinedStringLiteralsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow joining two or more string literals into a statically known string."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    return {
      CallExpression(node: Node) {
        if (!joinsOnlyStaticStrings(node)) return;
        context.report({
          node: node as never,
          messageId: "JOINED_STRING_LITERALS"
        });
      }
    };
  }
});
