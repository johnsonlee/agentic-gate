/**
 * Keeps filesystem ownership aligned with workspace project boundaries.
 *
 * A workspace member may directly execute and export files that it owns. It
 * must not reach outside its directory from a `package.json` script, and its
 * public package interface must expose build artifacts rather than source
 * files. Cross-project use goes through the dependency package name and public
 * artifact interface; the workspace root remains the composition root that may
 * invoke member-project artifacts. This rule has no options.
 *
 * | Kind | Violation condition | Repair |
 * | --- | --- | --- |
 * | `SCRIPT_REFERENCE` | A member package script contains a parent-directory path segment (`../` or `..\\`). | Move the build entry into the project or invoke a declared package artifact. |
 * | `SOURCE_EXPORT` | A member package export resolves to a source file included in the gate analysis. | Export the corresponding build artifact. |
 * | `SOURCE_REFERENCE` | A source import resolves to a file owned by another workspace project. | Import the target package's public artifact interface. |
 *
 * @module
 */

import {
  CrossProjectFileReferenceKinds,
  defineProjectRule
} from "agentic-gate-engine";

interface CrossProjectFileReferenceContext {
  kind: typeof CrossProjectFileReferenceKinds[keyof typeof CrossProjectFileReferenceKinds];
  project: string;
  reference: string;
  script?: string;
  target?: string;
}

function message(context: CrossProjectFileReferenceContext): string {
  if (context.kind === CrossProjectFileReferenceKinds.SCRIPT_REFERENCE) {
    return `'${context.project}' script '${context.script}' contains a parent-directory path in command '${context.reference}'.`;
  }
  if (context.kind === CrossProjectFileReferenceKinds.SOURCE_REFERENCE) {
    return `'${context.project}' directly reads '${context.reference}', a file owned by '${context.target}'.`;
  }
  return `'${context.project}' exports source file '${context.reference}' instead of a build artifact.`;
}

function instruction(context: CrossProjectFileReferenceContext): string {
  if (context.kind === CrossProjectFileReferenceKinds.SCRIPT_REFERENCE) {
    return `Remove the parent-directory path from script '${context.script}'; move the entry into '${context.project}' or invoke a declared package artifact.`;
  }
  if (context.kind === CrossProjectFileReferenceKinds.SOURCE_REFERENCE) {
    return `Import '${context.target}' through its public artifact interface and remove direct file specifier '${context.reference}'.`;
  }
  return `Build '${context.reference}' and expose its generated artifact from '${context.project}'.`;
}

/** @hidden */
export default defineProjectRule<CrossProjectFileReferenceContext>(import.meta.url, {
  engine: "workspace-boundaries",
  message,
  instruction
});
