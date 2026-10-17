/**
 * Reports `const` object literals asserted with `as const` unless the object
 * name starts with an uppercase letter and every static field uses
 * `UPPER_SNAKE_CASE`.
 *
 * Ordinary object bindings and objects asserted as another TypeScript type are
 * not constant collections and are outside this rule. Computed properties are
 * dynamic and have no static field name to validate. The rule has no options.
 *
 * @example
 * ```ts
 * const gateConfigValues = { autoEntries: "auto" } as const; // reported
 * const GateConfigValues = { AUTO_ENTRIES: "auto" } as const;
 * ```
 * @module
 */

import {
  AstNodeTypes,
  constantObjectExpression,
  JavaScriptKeywords,
  staticPropertyName
} from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  CONSTANT_OBJECT_NAME:
    "Constant object '{{name}}' must start with an uppercase letter.",
  CONSTANT_FIELD_NAME:
    "Constant object field '{{name}}' must use UPPER_SNAKE_CASE."
} as const;

type NoMisnamedConstantObjectsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const UPPERCASE_INITIAL = /^[A-Z]/u;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

/** @hidden */
export default defineRule<NoMisnamedConstantObjectsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce constant-object and field naming conventions."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const declaration = context.sourceCode.getAncestors(node).at(-1) as Node | undefined;
        const object = constantObjectExpression(node.init as Node | null);
        if (
          declaration?.type !== AstNodeTypes.VARIABLE_DECLARATION ||
          declaration.kind !== JavaScriptKeywords.CONST ||
          node.id.type !== AstNodeTypes.IDENTIFIER ||
          !object
        ) return;

        if (!UPPERCASE_INITIAL.test(node.id.name)) {
          context.report({
            node: node.id,
            messageId: "CONSTANT_OBJECT_NAME",
            data: { name: node.id.name }
          });
        }

        for (const property of object.properties as Node[]) {
          const name = staticPropertyName(property);
          if (name === undefined || UPPER_SNAKE_CASE.test(name)) continue;
          context.report({
            node: property.key,
            messageId: "CONSTANT_FIELD_NAME",
            data: { name }
          });
        }
      }
    };
  }
});
