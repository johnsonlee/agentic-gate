/**
 * Reports language-level catch clauses that neither propagate an error nor
 * move the caught value into an explicit handling sink. The accepted sinks
 * are syntactic and exhaustive: a throw, a call or constructor argument, a
 * return or yield value, or the right side of an assignment. A comment, bare
 * reference, unrelated recovery call, or handler without an error binding
 * does not prove that the error was handled.
 *
 * A member named `catch` is not analyzed because syntax alone cannot prove the
 * receiver is a Promise. That requires type-resolved analysis. This rule has
 * no options.
 *
 * @module
 */

import {
  AstNodeTypes,
  JavaScriptValueTypes
} from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  SILENT_CATCH:
    "This catch handler does not handle or propagate the caught error. Pass the error to a handler, return or store it deliberately, or throw it."
} as const;

type NoSilentCatchRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const nestedScopeTypes = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassDeclaration",
  "ClassExpression"
]);
const handlingContextTypes = new Set([
  "CallExpression",
  "NewExpression",
  "ReturnStatement",
  "YieldExpression"
]);
const ignoredTraversalKeys = new Set(["parent", "loc", "range", "tokens", "comments"]);

interface DeclaredVariable {
  identifiers: Node[];
  references: Array<{ identifier: Node }>;
}

function isNestedScope(current: Node, root: Node): boolean {
  return current !== root && nestedScopeTypes.has(current.type);
}

function isHandledReference(
  current: Node,
  handlingContext: boolean,
  references: ReadonlySet<Node>
): boolean {
  return current.type === AstNodeTypes.IDENTIFIER && handlingContext && references.has(current);
}

function referenceNodes(variables: readonly DeclaredVariable[]): Set<Node> {
  return new Set(
    variables.flatMap((variable) =>
      variable.references.map((reference) => reference.identifier as Node)
    )
  );
}

function handlerHandled(
  root: Node,
  body: Node,
  references: ReadonlySet<Node>
): boolean {
  let handled = false;

  function visit(value: unknown, handlingContext = false): void {
    if (handled || !value || typeof value !== JavaScriptValueTypes.OBJECT) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, handlingContext);
      return;
    }

    const current = value as Node;
    if (isNestedScope(current, root)) return;
    if (current.type === AstNodeTypes.THROW_STATEMENT) {
      handled = true;
      return;
    }
    if (isHandledReference(current, handlingContext, references)) {
      handled = true;
      return;
    }

    if (current.type === AstNodeTypes.ASSIGNMENT_EXPRESSION) {
      visit(current.left, false);
      visit(current.right, true);
      return;
    }

    const createsHandlingContext = handlingContextTypes.has(current.type);
    for (const [key, child] of Object.entries(current)) {
      if (ignoredTraversalKeys.has(key)) continue;
      visit(child, handlingContext || createsHandlingContext);
    }
  }

  visit(body);
  return handled;
}

/** @hidden */
export default defineRule<NoSilentCatchRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow catch handlers that silently discard errors."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    return {
      CatchClause(node) {
        const variables = context.sourceCode.getDeclaredVariables(node) as DeclaredVariable[];
        if (!handlerHandled(node as Node, node.body as Node, referenceNodes(variables))) {
          context.report({
            node: node.body,
            messageId: "SILENT_CATCH"
          });
        }
      }
    };
  }
});
