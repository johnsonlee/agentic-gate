/**
 * Protects the public interface of every architecture layer discovered from
 * the root workspace `package.json`.
 *
 * A cross-package import is valid only when the caller declares the target as
 * a direct dependency, the specifier starts at the target package name, and the
 * complete specifier is public in the target package's `exports`. This produces
 * two exact violation kinds:
 *
 * | Kind | Violation condition | Repair |
 * | --- | --- | --- |
 * | `PRIVATE_IMPORT` | A package-name import reaches a workspace subpath absent from the target's `exports`. | Export the required interface or use an existing public entry. |
 * | `UNDECLARED_DEPENDENCY` | A package imports another workspace package without listing it in a dependency group. | Declare the target as a direct dependency of the caller. |
 *
 * The check operates on the entire workspace in one run. Running it against
 * isolated packages would hide cross-package edges and is therefore not a
 * valid architecture gate. This rule has no options.
 *
 * @module
 */

import {
  defineProjectRule,
  WorkspaceBoundaryKinds
} from "agentic-gate-engine";

interface WorkspaceBoundaryContext {
  kind: typeof WorkspaceBoundaryKinds[keyof typeof WorkspaceBoundaryKinds];
  caller: string;
  target: string;
  specifier: string;
}

function message(context: WorkspaceBoundaryContext): string {
  if (context.kind === WorkspaceBoundaryKinds.UNDECLARED_DEPENDENCY) {
    return `'${context.caller}' imports '${context.target}' without declaring it as a direct dependency.`;
  }
  return `Private workspace path '${context.specifier}' is imported by '${context.caller}' through provider '${context.target}'.`;
}

function instruction(context: WorkspaceBoundaryContext): string {
  if (context.kind === WorkspaceBoundaryKinds.UNDECLARED_DEPENDENCY) {
    return `Declare '${context.target}' directly in '${context.caller}' and keep the dependency pointing toward a lower project.`;
  }
  return `Expose the required interface from '${context.target}' or replace '${context.specifier}' with an existing public export.`;
}

/** @hidden */
export default defineProjectRule<WorkspaceBoundaryContext>(import.meta.url, {
  engine: "workspace-boundaries",
  message,
  instruction
});
