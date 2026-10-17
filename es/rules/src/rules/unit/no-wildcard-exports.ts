/**
 * Reports wildcard re-exports because they make a module's public interface
 * depend on every current and future export of another file. Module interfaces
 * must name each exported symbol so an implementation change cannot silently
 * expand the public API. Type-only wildcard exports are subject to the same
 * rule. This rule has no options.
 *
 * @example
 * ```ts
 * export * from "./internal.ts"; // reported
 * export { PublicApi } from "./internal.ts";
 * export type { PublicOptions } from "./internal.ts";
 * ```
 * @module
 */

import { defineRule } from "./policy.ts";

const Messages = {
  WILDCARD_EXPORT:
    "Wildcard export leaks an open-ended interface. Replace it with explicit named exports."
} as const;

type NoWildcardExportsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

/** @hidden */
export default defineRule<NoWildcardExportsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Require every module interface to declare explicit exports."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    return {
      ExportAllDeclaration(node) {
        context.report({ node, messageId: "WILDCARD_EXPORT" });
      }
    };
  }
});
