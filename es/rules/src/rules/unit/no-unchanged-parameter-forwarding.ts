/**
 * Reports a function whose only behavior is calling another function with the
 * same parameter set, including reordered parameters. It covers normal,
 * arrow, async, zero-parameter, and rest-parameter functions.
 *
 * Constructors, decorated methods, default or destructured parameters,
 * transformed arguments, callbacks, and bodies with additional statements are
 * excluded. This rule has no options.
 *
 * @module
 */

import { AstNodeTypes } from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  UNCHANGED_FORWARDING:
    "Function '{{name}}' only forwards its parameters unchanged to '{{callee}}'. Call '{{callee}}' directly, or add the behavior that makes this wrapper necessary."
} as const;

type NoUnchangedParameterForwardingRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const transparent = new Set([
  "AwaitExpression",
  "ChainExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion"
]);
const VALUE_PARAMETER_PREFIX = "value:";
const SPREAD_PARAMETER_PREFIX = "spread:";
const CONSTRUCTOR_KIND = "constructor";

function unwrap(node: Node | undefined): Node | undefined {
  while (node && transparent.has(node.type)) node = node.expression ?? node.argument;
  return node;
}

function forwardingCall(body: Node): Node | undefined {
  if (body.type !== AstNodeTypes.BLOCK_STATEMENT) {
    return unwrap(body)?.type === AstNodeTypes.CALL_EXPRESSION ? unwrap(body) : undefined;
  }
  const statements = body.body.filter(
    (statement: Node) => statement.type !== AstNodeTypes.EXPRESSION_STATEMENT || !statement.directive
  );
  if (statements.length !== 1) return undefined;
  const statement = statements[0];
  const expression = statement.type === AstNodeTypes.RETURN_STATEMENT ? statement.argument :
    statement.type === AstNodeTypes.EXPRESSION_STATEMENT ? statement.expression : undefined;
  const call = unwrap(expression);
  return call?.type === AstNodeTypes.CALL_EXPRESSION && !call.optional ? call : undefined;
}

function parameterToken(node: Node): string | undefined {
  if (node.type === AstNodeTypes.IDENTIFIER) return VALUE_PARAMETER_PREFIX + node.name;
  if (node.type === AstNodeTypes.REST_ELEMENT && node.argument?.type === AstNodeTypes.IDENTIFIER) {
    return SPREAD_PARAMETER_PREFIX + node.argument.name;
  }
  return undefined;
}

function argumentToken(node: Node): string | undefined {
  const unwrapped = unwrap(node);
  if (unwrapped?.type === AstNodeTypes.IDENTIFIER) return VALUE_PARAMETER_PREFIX + unwrapped.name;
  if (unwrapped?.type === AstNodeTypes.SPREAD_ELEMENT && unwrapped.argument?.type === AstNodeTypes.IDENTIFIER) {
    return SPREAD_PARAMETER_PREFIX + unwrapped.argument.name;
  }
  return undefined;
}

function propertyName(parent: Node | undefined): string | undefined {
  if (
    (parent?.type !== AstNodeTypes.METHOD_DEFINITION && parent?.type !== AstNodeTypes.PROPERTY) ||
    parent.computed
  ) {
    return undefined;
  }
  return parent.key?.name ?? String(parent.key?.value ?? "<anonymous>");
}

function functionName(node: Node, sourceCode: { getAncestors(node: Node): Node[] }): string {
  if (node.id?.name) return node.id.name;
  const parent = sourceCode.getAncestors(node).at(-1);
  if (parent?.type === AstNodeTypes.VARIABLE_DECLARATOR && parent.id?.type === AstNodeTypes.IDENTIFIER) {
    return parent.id.name;
  }
  return propertyName(parent) ?? "<anonymous>";
}

function isCallback(node: Node, parent: Node | undefined): boolean {
  return (parent?.type === AstNodeTypes.CALL_EXPRESSION || parent?.type === AstNodeTypes.NEW_EXPRESSION) &&
    parent.arguments.includes(node);
}

function isUndefined(value: string | undefined): boolean {
  return value === undefined;
}

/** @hidden */
export default defineRule<NoUnchangedParameterForwardingRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow functions that only forward their parameters to another function.",
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function inspect(node: Node): void {
      const ancestors = sourceCode.getAncestors(node as never) as Node[];
      const parent = ancestors.at(-1);
      if (isCallback(node, parent)) return;
      if (
        parent?.type === AstNodeTypes.METHOD_DEFINITION &&
        (parent.kind === CONSTRUCTOR_KIND || parent.decorators?.length)
      ) return;

      const name = functionName(node, sourceCode as any);
      const parameters = node.params.map(parameterToken);
      if (parameters.some(isUndefined)) return;
      const call = forwardingCall(node.body);
      if (!call || call.callee?.type === AstNodeTypes.SUPER) return;
      const arguments_ = call.arguments.map(argumentToken);
      if (arguments_.some(isUndefined) || arguments_.length !== parameters.length) return;
      if ([...parameters].sort().join("\0") !== [...arguments_].sort().join("\0")) return;

      context.report({
        node,
        messageId: "UNCHANGED_FORWARDING",
        data: { name, callee: sourceCode.getText(call.callee as never) }
      });
    }

    return {
      FunctionDeclaration: inspect,
      FunctionExpression: inspect,
      ArrowFunctionExpression: inspect
    };
  }
});
