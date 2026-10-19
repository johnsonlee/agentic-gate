import { dirname, extname, join, resolve } from "node:path";
import {
  AstNodeTypes,
  isJavaScriptString,
  JavaScriptValueTypes
} from "./ast.ts";
import { SourceExtensions } from "./files.ts";
import type { SourceNode } from "./parser.ts";

/** A static source dependency and the syntax node that declares it. */
export interface SourceReference {
  specifier: string;
  node: SourceNode;
  typeOnly: boolean;
}

export const ModuleIndexBaseName = "index";
export const PathSegments = {
  CURRENT_DIRECTORY: ".",
  EMPTY: "",
  PARENT_DIRECTORY: ".."
} as const;

const ignoredTraversalKeys = new Set([
  "comments",
  "loc",
  "parent",
  "range",
  "tokens"
]);
const TYPE_REFERENCE_KIND = "type";
function staticString(node: SourceNode | null | undefined): string | undefined {
  if (node?.type !== AstNodeTypes.LITERAL || !isJavaScriptString(node.value)) return undefined;
  return node.value;
}

function declarationSpecifier(node: SourceNode): string | undefined {
  if (
    node.type !== AstNodeTypes.IMPORT_DECLARATION &&
    node.type !== AstNodeTypes.EXPORT_NAMED_DECLARATION &&
    node.type !== AstNodeTypes.EXPORT_ALL_DECLARATION
  ) return undefined;
  return staticString(node.source);
}

function expressionSpecifier(node: SourceNode): string | undefined {
  if (node.type === AstNodeTypes.IMPORT_EXPRESSION) return staticString(node.source);
  if (
    node.type === AstNodeTypes.TS_IMPORT_EQUALS_DECLARATION &&
    node.moduleReference?.type === AstNodeTypes.TS_EXTERNAL_MODULE_REFERENCE
  ) return staticString(node.moduleReference.expression);
  return undefined;
}

function isTypeOnlyReference(node: SourceNode): boolean {
  if (
    node.importKind === TYPE_REFERENCE_KIND ||
    node.exportKind === TYPE_REFERENCE_KIND
  ) return true;
  return Array.isArray(node.specifiers) &&
    node.specifiers.length > 0 &&
    node.specifiers.every((specifier: SourceNode) =>
      specifier.importKind === TYPE_REFERENCE_KIND ||
      specifier.exportKind === TYPE_REFERENCE_KIND
    );
}

/** Collects static imports, re-exports, dynamic imports, and TS import-equals. */
export function collectSourceReferences(program: SourceNode): SourceReference[] {
  const references: SourceReference[] = [];

  function visit(value: unknown): void {
    if (value === null || typeof value !== JavaScriptValueTypes.OBJECT) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const node = value as SourceNode;
    const specifier = declarationSpecifier(node) ?? expressionSpecifier(node);
    if (specifier !== undefined) {
      references.push({
        specifier,
        node: node.source ?? node,
        typeOnly: isTypeOnlyReference(node)
      });
    }
    for (const [key, child] of Object.entries(node)) {
      if (!ignoredTraversalKeys.has(key)) visit(child);
    }
  }

  visit(program);
  return references;
}

export function cleanSourceSpecifier(specifier: string): string {
  return specifier.split(/[?#]/u, 1)[0] ?? specifier;
}

/** Identifies a relative source specifier without resolving its target. */
export function isRelativeSourceSpecifier(specifier: string): boolean {
  return specifier === PathSegments.CURRENT_DIRECTORY ||
    specifier === PathSegments.PARENT_DIRECTORY ||
    specifier.startsWith(`${PathSegments.CURRENT_DIRECTORY}/`) ||
    specifier.startsWith(`${PathSegments.PARENT_DIRECTORY}/`);
}

function sourceCandidates(importer: string, specifier: string): string[] {
  const basePath = resolve(dirname(importer), cleanSourceSpecifier(specifier));
  const extension = extname(basePath);
  if (extension) return [basePath];
  return [
    ...SourceExtensions.map((sourceExtension) => `${basePath}${sourceExtension}`),
    ...SourceExtensions.map((sourceExtension) =>
      join(basePath, `${ModuleIndexBaseName}${sourceExtension}`)
    )
  ];
}

/** Resolves a local source reference against the analyzed source inventory. */
export function resolveSourceReference(
  importer: string,
  specifier: string,
  sourceFiles: ReadonlySet<string>
): string | undefined {
  if (!isRelativeSourceSpecifier(specifier)) return undefined;
  const matches = sourceCandidates(importer, specifier).filter((candidate) =>
    sourceFiles.has(candidate)
  );
  if (matches.length > 1) {
    throw new Error(
      `Source reference '${specifier}' from '${importer}' is ambiguous: ${matches.join(", ")}`
    );
  }
  return matches[0];
}

/** Converts parser coordinates to the public one-based source position. */
export function sourceNodeLocation(
  node: SourceNode
): { start?: { line: number; column: number } } {
  if (!node.loc?.start) return {};
  return {
    start: {
      line: node.loc.start.line,
      column: node.loc.start.column + 1
    }
  };
}
