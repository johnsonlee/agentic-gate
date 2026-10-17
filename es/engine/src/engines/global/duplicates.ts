/** Detects duplicate source constructs that require project-level context. */

import { dirname, relative } from "node:path";
import {
  AstNodeTypes,
  constantObjectExpression,
  JavaScriptKeywords,
  JavaScriptValueTypes,
  staticPropertyName,
  type ProjectContext,
  type SourceNode
} from "../../project";
import {
  createProjectViolation,
  type ProjectRule,
  type Violation
} from "../../contract";

export interface SourceDuplicateRules {
  constantsInModule: ProjectRule<any>;
  functions: ProjectRule<any>;
  statements: ProjectRule<any>;
  templateLiteralFragments: ProjectRule<any>;
}

type Node = SourceNode;

const DuplicateUnitKinds = {
  FUNCTION: "function",
  STATEMENT: "top-level statement"
} as const;

interface DuplicateUnit {
  kind: typeof DuplicateUnitKinds[keyof typeof DuplicateUnitKinds];
  label: string;
  value: unknown;
  node: Node;
}

interface LocatedDuplicateUnit extends DuplicateUnit {
  filePath: string;
}

interface TemplateLiteralFragment {
  value: string;
  node: Node;
}

interface LocatedTemplateLiteralFragment extends TemplateLiteralFragment {
  filePath: string;
}

interface ConstantDefinition {
  label: string;
  value: string | number | boolean | bigint | null;
  node: Node;
}

interface LocatedConstantDefinition extends ConstantDefinition {
  filePath: string;
}

interface SourceDuplicateState {
  seenUnits: Map<string, LocatedDuplicateUnit>;
  seenFragments: Map<string, LocatedTemplateLiteralFragment>;
  constantsByDirectory: Map<string, LocatedConstantDefinition[]>;
  rules: SourceDuplicateRules;
  violations: Violation[];
}

const ignoredFingerprintKeys = new Set([
  "comments",
  "loc",
  "parent",
  "range",
  "raw",
  "start",
  "end",
  "tokens"
]);
const ignoredTopLevelStatements = new Set([
  "ClassDeclaration",
  "EmptyStatement",
  "ExportAllDeclaration",
  "ImportDeclaration",
  "TSDeclareFunction",
  "TSEnumDeclaration",
  "TSImportEqualsDeclaration",
  "TSInterfaceDeclaration",
  "TSModuleDeclaration",
  "TSNamespaceExportDeclaration",
  "TSTypeAliasDeclaration"
]);
const UnaryOperators = {
  MINUS: "-",
  PLUS: "+"
} as const;
const transparentExpressionTypes = new Set<string>([
  AstNodeTypes.TS_AS_EXPRESSION,
  AstNodeTypes.TS_NON_NULL_EXPRESSION,
  AstNodeTypes.TS_SATISFIES_EXPRESSION,
  AstNodeTypes.TS_TYPE_ASSERTION
]);

function fingerprint(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === JavaScriptValueTypes.BIGINT) return `bigint:${value.toString()}`;
  if (typeof value !== JavaScriptValueTypes.OBJECT) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => !ignoredFingerprintKeys.has(key))
    .sort()
    .map((key) => `${JSON.stringify(key)}:${fingerprint(record[key])}`)
    .join(",")}}`;
}

function unwrapExport(statement: Node): Node | undefined {
  if (
    statement.type === AstNodeTypes.EXPORT_NAMED_DECLARATION ||
    statement.type === AstNodeTypes.EXPORT_DEFAULT_DECLARATION
  ) {
    return statement.declaration?.type ? statement.declaration : undefined;
  }
  return statement;
}

function isFunction(node: Node | undefined): boolean {
  return node !== undefined && [
    "ArrowFunctionExpression",
    "FunctionDeclaration",
    "FunctionExpression"
  ].includes(node.type);
}

function containsDirectFunction(statement: Node): boolean {
  return statement.type === AstNodeTypes.VARIABLE_DECLARATION && statement.declarations.some(
    (declaration: Node) => isFunction(declaration.init)
  );
}

function statementLabel(statement: Node): string {
  if (statement.type === AstNodeTypes.VARIABLE_DECLARATION) {
    const names = statement.declarations
      .map((declaration: Node) =>
        declaration.id?.type === AstNodeTypes.IDENTIFIER ? declaration.id.name : undefined
      )
      .filter((name: string | undefined): name is string => name !== undefined);
    if (names.length > 0) return names.join(", ");
  }
  return statement.type;
}

function functionLabel(node: Node, parent: Node | undefined): string {
  if (node.id?.name) return node.id.name;
  if (parent?.type === AstNodeTypes.VARIABLE_DECLARATOR && parent.id?.type === AstNodeTypes.IDENTIFIER) {
    return parent.id.name;
  }
  if (
    (parent?.type === AstNodeTypes.METHOD_DEFINITION ||
      parent?.type === AstNodeTypes.PROPERTY_DEFINITION) &&
    parent.key
  ) {
    if (parent.key.type === AstNodeTypes.PRIVATE_IDENTIFIER) return `#${parent.key.name}`;
    if (parent.key.type === AstNodeTypes.IDENTIFIER) return parent.key.name;
    if (parent.key.type === AstNodeTypes.LITERAL) return String(parent.key.value);
  }
  return "anonymous function";
}

function functionValue(node: Node): Record<string, unknown> {
  const value = { ...node };
  delete value.id;
  return value;
}

function collectFunctions(value: unknown, units: DuplicateUnit[], parent?: Node): void {
  if (value === null || typeof value !== JavaScriptValueTypes.OBJECT) return;
  if (Array.isArray(value)) {
    for (const item of value) collectFunctions(item, units, parent);
    return;
  }

  const node = value as Node;
  if (isFunction(node)) {
    units.push({
      kind: DuplicateUnitKinds.FUNCTION,
      label: functionLabel(node, parent),
      value: functionValue(node),
      node
    });
  }

  for (const [key, child] of Object.entries(node)) {
    if (ignoredFingerprintKeys.has(key)) continue;
    collectFunctions(child, units, node);
  }
}

function collectDuplicateUnits(program: Node): DuplicateUnit[] {
  const units: DuplicateUnit[] = [];

  for (const programStatement of program.body as Node[]) {
    const statement = unwrapExport(programStatement);
    if (!statement) continue;

    if (
      statement.type !== AstNodeTypes.FUNCTION_DECLARATION &&
      !ignoredTopLevelStatements.has(statement.type) &&
      !containsDirectFunction(statement) &&
      !(statement.type === AstNodeTypes.EXPRESSION_STATEMENT && statement.directive)
    ) {
      units.push({
        kind: DuplicateUnitKinds.STATEMENT,
        label: statementLabel(statement),
        value: statement,
        node: statement
      });
    }

    collectFunctions(statement, units);
  }

  return units;
}

function collectTemplateLiteralFragments(value: unknown): TemplateLiteralFragment[] {
  const fragments: TemplateLiteralFragment[] = [];

  function visit(current: unknown): void {
    if (current === null || typeof current !== JavaScriptValueTypes.OBJECT) return;
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    const node = current as Node;
    if (node.type === AstNodeTypes.TEMPLATE_ELEMENT) {
      const fragment = node.value?.cooked ?? node.value?.raw;
      if (
        typeof fragment === JavaScriptValueTypes.STRING &&
        /[\p{L}\p{M}\p{N}\p{Pc}]/u.test(fragment)
      ) {
        fragments.push({ value: fragment, node });
      }
    }

    for (const [key, child] of Object.entries(node)) {
      if (ignoredFingerprintKeys.has(key)) continue;
      visit(child);
    }
  }

  visit(value);
  return fragments.sort((left, right) =>
    (left.node.range?.[0] ?? 0) - (right.node.range?.[0] ?? 0)
  );
}

function literalPrimitiveValue(value: unknown): ConstantDefinition["value"] | undefined {
  if (value === null) return value;
  const valueType = typeof value;
  if (valueType === JavaScriptValueTypes.STRING) return value as string;
  if (valueType === JavaScriptValueTypes.NUMBER) return value as number;
  if (valueType === JavaScriptValueTypes.BIGINT) return value as bigint;
  if (valueType === JavaScriptValueTypes.BOOLEAN) return value as boolean;
  return undefined;
}

function staticTemplateValue(node: Node): string | undefined {
  if (node.expressions?.length !== 0 || node.quasis?.length !== 1) return undefined;
  return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
}

function signedNumericValue(node: Node): number | bigint | undefined {
  if (node.argument?.type !== AstNodeTypes.LITERAL) return undefined;
  const value = node.argument.value;
  if (typeof value === JavaScriptValueTypes.NUMBER) {
    if (node.operator === UnaryOperators.MINUS) return -value;
    if (node.operator === UnaryOperators.PLUS) return value;
  }
  if (
    typeof value === JavaScriptValueTypes.BIGINT &&
    node.operator === UnaryOperators.MINUS
  ) return -value;
  return undefined;
}

function primitiveValue(node: Node | null | undefined): ConstantDefinition["value"] | undefined {
  while (node && transparentExpressionTypes.has(node.type)) node = node.expression;
  if (node?.type === AstNodeTypes.LITERAL) return literalPrimitiveValue(node.value);
  if (node?.type === AstNodeTypes.TEMPLATE_LITERAL) return staticTemplateValue(node);
  if (node?.type === AstNodeTypes.UNARY_EXPRESSION) return signedNumericValue(node);
  return undefined;
}

function collectConstantObjectFields(
  bindingName: string,
  object: Node,
  definitions: ConstantDefinition[]
): void {
  for (const property of object.properties as Node[]) {
    const name = staticPropertyName(property);
    const value = primitiveValue(property.value);
    if (name === undefined || value === undefined) continue;
    definitions.push({
      label: `${bindingName}.${name}`,
      value,
      node: property.key
    });
  }
}

function collectConstantDeclarator(
  declaration: Node,
  definitions: ConstantDefinition[]
): void {
  if (declaration.id?.type !== AstNodeTypes.IDENTIFIER) return;
  const object = constantObjectExpression(declaration.init);
  if (object) {
    collectConstantObjectFields(declaration.id.name, object, definitions);
    return;
  }

  const name = declaration.id.name;
  const value = primitiveValue(declaration.init);
  if (value === undefined) return;
  definitions.push({
    label: name,
    value,
    node: declaration.id
  });
}

function collectConstantDefinitions(program: Node): ConstantDefinition[] {
  const definitions: ConstantDefinition[] = [];

  for (const programStatement of program.body as Node[]) {
    const statement = unwrapExport(programStatement);
    if (
      statement?.type !== AstNodeTypes.VARIABLE_DECLARATION ||
      statement.kind !== JavaScriptKeywords.CONST
    ) continue;

    for (const declaration of statement.declarations as Node[]) {
      collectConstantDeclarator(declaration, definitions);
    }
  }

  return definitions;
}

function valueKey(value: ConstantDefinition["value"]): string {
  if (value === null) return "object:null";
  if (typeof value === JavaScriptValueTypes.NUMBER && Object.is(value, -0)) {
    return "number:-0";
  }
  return `${typeof value}:${String(value)}`;
}

function location(node: Node): { start?: { line: number; column: number } } {
  if (!node.loc?.start) return {};
  return {
    start: {
      line: node.loc.start.line,
      column: node.loc.start.column + 1
    }
  };
}

function sourceReference(cwd: string, filePath: string, node: Node): string {
  const sourceFile = relative(cwd, filePath);
  return node.loc?.start ? `${sourceFile}:${node.loc.start.line}` : sourceFile;
}

function collectLocatedConstants(
  filePath: string,
  program: Node,
  constantsByDirectory: Map<string, LocatedConstantDefinition[]>
): void {
  const moduleDirectory = dirname(filePath);
  const definitions = constantsByDirectory.get(moduleDirectory) ?? [];
  for (const definition of collectConstantDefinitions(program)) {
    definitions.push({ ...definition, filePath });
  }
  constantsByDirectory.set(moduleDirectory, definitions);
}

function reportSourceUnitDuplicates(
  cwd: string,
  filePath: string,
  program: Node,
  state: SourceDuplicateState
): void {
  for (const unit of collectDuplicateUnits(program)) {
    const key = `${unit.kind}:${fingerprint(unit.value)}`;
    const first = state.seenUnits.get(key);
    if (!first) {
      state.seenUnits.set(key, { ...unit, filePath });
      continue;
    }

    const rule = unit.kind === DuplicateUnitKinds.FUNCTION
      ? state.rules.functions
      : state.rules.statements;
    state.violations.push(createProjectViolation(
      rule,
      {
        label: unit.label,
        originalLabel: first.label,
        originalLocation: sourceReference(cwd, first.filePath, first.node)
      },
      {
        file: relative(cwd, filePath),
        ...location(unit.node)
      },
      { symbol: unit.label }
    ));
  }
}

function reportTemplateFragmentDuplicates(
  cwd: string,
  filePath: string,
  program: Node,
  state: SourceDuplicateState
): void {
  for (const fragment of collectTemplateLiteralFragments(program)) {
    const first = state.seenFragments.get(fragment.value);
    if (!first) {
      state.seenFragments.set(fragment.value, { ...fragment, filePath });
      continue;
    }

    state.violations.push(createProjectViolation(
      state.rules.templateLiteralFragments,
      {
        fragment: fragment.value,
        originalLocation: sourceReference(cwd, first.filePath, first.node)
      },
      {
        file: relative(cwd, filePath),
        ...location(fragment.node)
      }
    ));
  }
}

function definitionOrder(
  left: LocatedConstantDefinition,
  right: LocatedConstantDefinition
): number {
  if (left.filePath < right.filePath) return -1;
  if (left.filePath > right.filePath) return 1;
  const leftPosition = left.node.range?.[0];
  const rightPosition = right.node.range?.[0];
  if (leftPosition === undefined) return rightPosition === undefined ? 0 : 1;
  if (rightPosition === undefined) return -1;
  return leftPosition - rightPosition;
}

function originalConstant(
  definition: LocatedConstantDefinition,
  canonicalDefinitions: LocatedConstantDefinition[]
): LocatedConstantDefinition | undefined {
  return canonicalDefinitions.find((candidate) =>
    candidate.label === definition.label &&
    valueKey(candidate.value) === valueKey(definition.value)
  );
}

function reportConstantDuplicates(
  cwd: string,
  constantsByDirectory: Map<string, LocatedConstantDefinition[]>,
  rule: ProjectRule<any>,
  violations: Violation[]
): void {
  for (const definitions of constantsByDirectory.values()) {
    const canonicalDefinitions: LocatedConstantDefinition[] = [];
    for (const definition of definitions.sort(definitionOrder)) {
      const original = originalConstant(definition, canonicalDefinitions);
      if (!original) {
        canonicalDefinitions.push(definition);
        continue;
      }

      violations.push(createProjectViolation(
        rule,
        {
          label: definition.label,
          originalLabel: original.label,
          originalLocation: sourceReference(cwd, original.filePath, original.node)
        },
        {
          file: relative(cwd, definition.filePath),
          ...location(definition.node)
        },
        { symbol: definition.label }
      ));
    }
  }
}

/** Finds duplicate source constructs across the project. */
export async function findSourceDuplicates(
  context: ProjectContext,
  rules: SourceDuplicateRules
): Promise<Violation[]> {
  const { cwd, sources } = context;
  const state: SourceDuplicateState = {
    seenUnits: new Map(),
    seenFragments: new Map(),
    constantsByDirectory: new Map(),
    rules,
    violations: []
  };
  for (const { file: filePath, program } of sources) {
    if (!program) continue;
    if (!filePath.endsWith(".d.ts")) {
      collectLocatedConstants(filePath, program, state.constantsByDirectory);
      reportSourceUnitDuplicates(cwd, filePath, program, state);
    }
    reportTemplateFragmentDuplicates(cwd, filePath, program, state);
  }

  reportConstantDuplicates(
    cwd,
    state.constantsByDirectory,
    rules.constantsInModule,
    state.violations
  );
  return state.violations;
}
