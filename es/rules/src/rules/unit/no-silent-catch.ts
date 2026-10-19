/**
 * Reports an empty language-level catch clause because an empty body proves
 * that the exception was discarded. Any non-empty statement is treated as an
 * explicit response; this rule does not infer whether recovery, logging,
 * storage, or propagation is semantically sufficient. Promise `.catch()`
 * calls require type resolution and are outside this syntax rule. The rule has
 * no options.
 *
 * @module
 */

import { AstNodeTypes } from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  SILENT_CATCH:
    "This catch handler is empty and discards the exception. Handle the failure explicitly or propagate it."
} as const;

type NoSilentCatchRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

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
        const statements = (node.body as Node).body as Node[];
        if (statements.every((statement) => statement.type === AstNodeTypes.EMPTY_STATEMENT)) {
          context.report({
            node: node.body,
            messageId: "SILENT_CATCH"
          });
        }
      }
    };
  }
});
