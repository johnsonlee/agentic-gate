/**
 * Reports numeric literals in executable expressions when a named constant
 * should communicate their meaning.
 *
 * A number is named when the AST places it directly in a `const` initializer,
 * a statically named object field, an enum member, a readonly field, or a JSX
 * attribute. TypeScript literal types do not execute and are outside the rule.
 *
 * The values `-1`, `0`, and `1` are structural values rather than magic
 * numbers. Their meaning is fixed by the surrounding operation, so the rule
 * does not require names such as `NOT_FOUND`, `ZERO`, `FIRST_INDEX`, or `ONE`:
 *
 * - `-1` expresses absence, a failed search, or one position before a boundary;
 * - `0` expresses an empty-size boundary or the first position, as in
 *   `length === 0`, `range[0]`, and `cycle[0]`; and
 * - `1` expresses a single step or the next position, as in `index + 1`.
 *
 * The rule therefore excludes these three values wherever they occur. Code may
 * still define named constants for them when a domain concept benefits from a
 * name. Every other runtime number is reported unless its AST context names
 * its role, including radix arguments and default parameters. This rule has no
 * options.
 *
 * @example
 * ```ts
 * await sleep(5000); // reported
 * const RETRY_DELAY_MS = 5000;
 * await sleep(RETRY_DELAY_MS);
 * ```
 * @module
 */

import {
  AstNodeTypes,
  JavaScriptKeywords,
  JavaScriptValueTypes,
  staticPropertyName
} from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  MAGIC_NUMBER:
    "Magic number {{value}} obscures its meaning. Replace it with a named constant."
} as const;

type NoMagicNumbersRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const transparentTypes: ReadonlySet<string> = new Set([
  AstNodeTypes.CHAIN_EXPRESSION,
  AstNodeTypes.TS_AS_EXPRESSION,
  AstNodeTypes.TS_NON_NULL_EXPRESSION,
  AstNodeTypes.TS_SATISFIES_EXPRESSION,
  AstNodeTypes.TS_TYPE_ASSERTION
]);
const MINUS_OPERATOR = "-";
const PLUS_OPERATOR = "+";

function isNumeric(node: Node): boolean {
  return node.type === AstNodeTypes.LITERAL &&
    (typeof node.value === JavaScriptValueTypes.NUMBER ||
      typeof node.bigint === JavaScriptValueTypes.STRING);
}

interface NumericContext {
  ancestors: Node[];
  current: Node;
  index: number;
  numericValue?: number;
  parent?: Node;
}

const StructuralNumbers = new Set([-1, 0, 1]);

function numericContext(node: Node, ancestors: Node[]): NumericContext {
  let current = node;
  let index = ancestors.length - 1;
  let parent = ancestors[index];
  let numericValue = typeof node.value === JavaScriptValueTypes.NUMBER
    ? node.value
    : undefined;

  if (
    parent?.type === AstNodeTypes.UNARY_EXPRESSION &&
    (parent.operator === MINUS_OPERATOR || parent.operator === PLUS_OPERATOR) &&
    parent.argument === current
  ) {
    current = parent;
    index -= 1;
    parent = ancestors[index];
    if (numericValue !== undefined && current.operator === MINUS_OPERATOR) {
      numericValue *= -1;
    }
  }

  while (parent && transparentTypes.has(parent.type)) {
    current = parent;
    index -= 1;
    parent = ancestors[index];
  }
  return { ancestors, current, index, numericValue, parent };
}

function isTypeLiteral(parent: Node | undefined, current: Node): boolean {
  return parent?.type === AstNodeTypes.TS_LITERAL_TYPE && parent.literal === current;
}

function isConstInitializer(context: NumericContext): boolean {
  if (context.parent?.type !== AstNodeTypes.VARIABLE_DECLARATOR || context.parent.init !== context.current) {
    return false;
  }
  const declaration = context.ancestors[context.index - 1];
  return declaration?.type === AstNodeTypes.VARIABLE_DECLARATION &&
    declaration.kind === JavaScriptKeywords.CONST;
}

function isReadonlyField(parent: Node | undefined, current: Node): boolean {
  return (parent?.type === AstNodeTypes.PROPERTY_DEFINITION || parent?.type === AstNodeTypes.CLASS_PROPERTY) &&
    parent.value === current &&
    parent.readonly;
}

function isNamedPropertyValue(parent: Node | undefined, current: Node): boolean {
  return parent?.type === AstNodeTypes.PROPERTY &&
    parent.value === current &&
    staticPropertyName(parent) !== undefined;
}

function isJsxAttributeValue(context: NumericContext): boolean {
  if (
    context.parent?.type !== AstNodeTypes.JSX_EXPRESSION_CONTAINER ||
    context.parent.expression !== context.current
  ) return false;
  const attribute = context.ancestors[context.index - 1];
  return attribute?.type === AstNodeTypes.JSX_ATTRIBUTE &&
    attribute.value === context.parent &&
    attribute.name?.type === AstNodeTypes.JSX_IDENTIFIER;
}

function isEnumMember(parent: Node | undefined, current: Node): boolean {
  return parent?.type === AstNodeTypes.TS_ENUM_MEMBER && parent.initializer === current;
}

function isAllowedContext(context: NumericContext): boolean {
  const { current, parent } = context;
  if (isTypeLiteral(parent, current)) return true;
  if (isConstInitializer(context)) return true;
  if (isNamedPropertyValue(parent, current)) return true;
  if (isJsxAttributeValue(context)) return true;
  if (isEnumMember(parent, current)) return true;
  if (isReadonlyField(parent, current)) return true;
  return false;
}

/** @hidden */
export default defineRule<NoMagicNumbersRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unexplained numeric literals in executable code.",
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Literal(node) {
        if (!isNumeric(node as Node)) return;

        const ancestors = sourceCode.getAncestors(node) as Node[];
        const numeric = numericContext(node as Node, ancestors);
        const structuralValue = numeric.numericValue ??
          (typeof (node as Node).bigint === JavaScriptValueTypes.STRING
            ? Number((node as Node).bigint)
            : undefined);
        if (structuralValue !== undefined && StructuralNumbers.has(structuralValue)) return;
        if (isAllowedContext(numeric)) return;

        context.report({
          node: numeric.current,
          messageId: "MAGIC_NUMBER",
          data: { value: sourceCode.getText(numeric.current as never) }
        });
      }
    };
  }
});
