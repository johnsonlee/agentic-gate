/** ESTree and TypeScript ESTree node names used by built-in analyzers. */
export const AstNodeTypes = {
  ARRAY_EXPRESSION: "ArrayExpression",
  ARROW_FUNCTION_EXPRESSION: "ArrowFunctionExpression",
  ASSIGNMENT_EXPRESSION: "AssignmentExpression",
  ASSIGNMENT_PATTERN: "AssignmentPattern",
  BLOCK_STATEMENT: "BlockStatement",
  CALL_EXPRESSION: "CallExpression",
  CHAIN_EXPRESSION: "ChainExpression",
  CLASS_DECLARATION: "ClassDeclaration",
  CLASS_EXPRESSION: "ClassExpression",
  CLASS_PROPERTY: "ClassProperty",
  EMPTY_STATEMENT: "EmptyStatement",
  EXPORT_ALL_DECLARATION: "ExportAllDeclaration",
  EXPORT_DEFAULT_DECLARATION: "ExportDefaultDeclaration",
  EXPORT_NAMED_DECLARATION: "ExportNamedDeclaration",
  EXPRESSION_STATEMENT: "ExpressionStatement",
  FUNCTION_DECLARATION: "FunctionDeclaration",
  FUNCTION_EXPRESSION: "FunctionExpression",
  IDENTIFIER: "Identifier",
  IMPORT_DECLARATION: "ImportDeclaration",
  IMPORT_EXPRESSION: "ImportExpression",
  JSX_ATTRIBUTE: "JSXAttribute",
  JSX_EXPRESSION_CONTAINER: "JSXExpressionContainer",
  JSX_IDENTIFIER: "JSXIdentifier",
  LITERAL: "Literal",
  MEMBER_EXPRESSION: "MemberExpression",
  METHOD_DEFINITION: "MethodDefinition",
  NEW_EXPRESSION: "NewExpression",
  OBJECT_EXPRESSION: "ObjectExpression",
  PRIVATE_IDENTIFIER: "PrivateIdentifier",
  PROPERTY: "Property",
  PROPERTY_DEFINITION: "PropertyDefinition",
  REST_ELEMENT: "RestElement",
  RETURN_STATEMENT: "ReturnStatement",
  SPREAD_ELEMENT: "SpreadElement",
  SUPER: "Super",
  TAGGED_TEMPLATE_EXPRESSION: "TaggedTemplateExpression",
  TEMPLATE_ELEMENT: "TemplateElement",
  TEMPLATE_LITERAL: "TemplateLiteral",
  THROW_STATEMENT: "ThrowStatement",
  TS_AS_EXPRESSION: "TSAsExpression",
  TS_DECLARE_FUNCTION: "TSDeclareFunction",
  TS_ENUM_DECLARATION: "TSEnumDeclaration",
  TS_ENUM_MEMBER: "TSEnumMember",
  TS_EXTERNAL_MODULE_REFERENCE: "TSExternalModuleReference",
  TS_IMPORT_EQUALS_DECLARATION: "TSImportEqualsDeclaration",
  TS_INTERFACE_DECLARATION: "TSInterfaceDeclaration",
  TS_LITERAL_TYPE: "TSLiteralType",
  TS_MODULE_DECLARATION: "TSModuleDeclaration",
  TS_NAMESPACE_EXPORT_DECLARATION: "TSNamespaceExportDeclaration",
  TS_NON_NULL_EXPRESSION: "TSNonNullExpression",
  TS_SATISFIES_EXPRESSION: "TSSatisfiesExpression",
  TS_TYPE_REFERENCE: "TSTypeReference",
  TS_TYPE_ALIAS_DECLARATION: "TSTypeAliasDeclaration",
  TS_TYPE_ASSERTION: "TSTypeAssertion",
  UNARY_EXPRESSION: "UnaryExpression",
  VARIABLE_DECLARATION: "VariableDeclaration",
  VARIABLE_DECLARATOR: "VariableDeclarator",
  YIELD_EXPRESSION: "YieldExpression"
} as const;

/** JavaScript `typeof` results used by built-in analyzers. */
export const JavaScriptValueTypes = {
  BIGINT: "bigint",
  BOOLEAN: "boolean",
  NUMBER: "number",
  OBJECT: "object",
  STRING: "string"
} as const;

/** JavaScript keywords represented as strings in ESTree fields. */
export const JavaScriptKeywords = {
  CONST: "const"
} as const;

type AstNode = { type: string; [key: string]: any };

/** Narrows an unknown JavaScript value to a string. */
export function isJavaScriptString(value: unknown): value is string {
  return typeof value === JavaScriptValueTypes.STRING;
}

/** Returns the object from an `as const` expression, including outer `satisfies`. */
export function constantObjectExpression(
  init: AstNode | null | undefined
): AstNode | undefined {
  while (init?.type === AstNodeTypes.TS_SATISFIES_EXPRESSION) init = init.expression;
  if (
    init?.type !== AstNodeTypes.TS_AS_EXPRESSION ||
    init.typeAnnotation?.type !== AstNodeTypes.TS_TYPE_REFERENCE ||
    init.typeAnnotation.typeName?.name !== JavaScriptKeywords.CONST ||
    init.expression?.type !== AstNodeTypes.OBJECT_EXPRESSION
  ) return undefined;
  return init.expression;
}

/** Returns a non-computed object property's identifier or string name. */
export function staticPropertyName(property: AstNode): string | undefined {
  if (property.type !== AstNodeTypes.PROPERTY || property.computed) return undefined;
  if (property.key?.type === AstNodeTypes.IDENTIFIER) return property.key.name;
  if (
    property.key?.type === AstNodeTypes.LITERAL &&
    isJavaScriptString(property.key.value)
  ) return property.key.value;
  return undefined;
}
