/**
 * Reports two or more adjacent calls that push string literals into the same
 * receiver. Adjacency is defined by the containing statement list; comments
 * do not interrupt it because they are not statements. A single call may push
 * multiple strings and is therefore the required replacement. This rule has
 * no options.
 *
 * @example
 * ```ts
 * values.push("first");
 * values.push("second"); // reported
 *
 * values.push("first", "second");
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
  CONSECUTIVE_PUSH_STRING_LITERALS:
    "Consecutive calls push string literals into the same receiver. Combine them into one push call or push values from a named array."
} as const;

type NoConsecutivePushStringLiteralsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const ignoredStructureKeys = new Set([
  "comments",
  "loc",
  "parent",
  "range",
  "raw",
  "start",
  "end",
  "tokens"
]);
const PUSH_METHOD = "push";

interface PushCall {
  receiver: Node;
  statement: Node;
}

function structure(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== JavaScriptValueTypes.OBJECT) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(structure).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => !ignoredStructureKeys.has(key))
    .sort()
    .map((key) => `${JSON.stringify(key)}:${structure(record[key])}`)
    .join(",")}}`;
}

function memberName(member: Node): string | undefined {
  if (member.type !== AstNodeTypes.MEMBER_EXPRESSION) return undefined;
  if (!member.computed && member.property?.type === AstNodeTypes.IDENTIFIER) {
    return member.property.name;
  }
  if (
    member.computed &&
    member.property?.type === AstNodeTypes.LITERAL &&
    typeof member.property.value === JavaScriptValueTypes.STRING
  ) return member.property.value;
  return undefined;
}

function stringLiteral(node: Node): boolean {
  return node.type === AstNodeTypes.LITERAL &&
    typeof node.value === JavaScriptValueTypes.STRING;
}

function stringPush(statement: Node): PushCall | undefined {
  if (statement.type !== AstNodeTypes.EXPRESSION_STATEMENT) return undefined;
  const call = statement.expression;
  if (
    call?.type !== AstNodeTypes.CALL_EXPRESSION ||
    call.optional ||
    memberName(call.callee) !== PUSH_METHOD ||
    call.arguments.length === 0 ||
    !call.arguments.every(stringLiteral)
  ) return undefined;
  return { receiver: call.callee.object, statement };
}

function reportRuns(
  statements: readonly Node[],
  report: (statement: Node) => void
): void {
  let previousReceiver: string | undefined;
  let reported = false;

  for (const statement of statements) {
    const push = stringPush(statement);
    const receiver = push ? structure(push.receiver) : undefined;
    if (push && receiver === previousReceiver) {
      if (!reported) report(push.statement);
      reported = true;
    } else {
      reported = false;
    }
    previousReceiver = receiver;
  }
}

/** @hidden */
export default defineRule<NoConsecutivePushStringLiteralsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow adjacent calls that push string literals into the same receiver."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    const inspect = (node: Node): void => {
      reportRuns(node.body ?? node.consequent, (statement) => {
        context.report({
          node: statement as never,
          messageId: "CONSECUTIVE_PUSH_STRING_LITERALS"
        });
      });
    };

    return {
      Program: inspect,
      BlockStatement: inspect,
      StaticBlock: inspect,
      SwitchCase: inspect
    };
  }
});
