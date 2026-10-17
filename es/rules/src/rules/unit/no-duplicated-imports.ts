/**
 * Reports a module that appears in more than one static import declaration,
 * including declarations that split type and value imports. Consolidate them
 * into one declaration. Dynamic imports, CommonJS `require`, and re-exports
 * are outside this rule.
 *
 * @example
 * ```ts
 * import type { Config } from "./config";
 * import { loadConfig } from "./config"; // reported
 * ```
 * @module
 */

import { defineRule } from "./policy.ts";

const Messages = {
  DUPLICATE_IMPORT:
    "Module '{{module}}' is imported more than once (first imported on line {{line}}). Consolidate its imports into one declaration."
} as const;

type NoDuplicatedImportsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

/** @hidden */
export default defineRule<NoDuplicatedImportsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow more than one static import from the same module.",
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    const firstImports = new Map<string, { line: number }>();

    return {
      ImportDeclaration(node) {
        const moduleName = String(node.source.value);
        const first = firstImports.get(moduleName);

        if (first) {
          context.report({
            node: node.source,
            messageId: "DUPLICATE_IMPORT",
            data: { module: moduleName, line: String(first.line) }
          });
          return;
        }

        firstImports.set(moduleName, { line: node.loc?.start.line ?? 1 });
      }
    };
  }
});
