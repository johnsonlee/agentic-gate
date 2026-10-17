/**
 * Reports module internals that leak across directory boundaries. A named
 * source file is a single-file interface. A directory becomes a module only
 * when its `index` file fronts additional implementation files; callers
 * outside that directory reference the directory itself.
 *
 * The rule blocks three forms of leakage: a local reference that names an
 * index or bypasses a directory module, an index-only directory that should
 * be a named source file, and a `package.json` export target that exposes a
 * module implementation file. Bare specifiers, aliases, unresolved
 * references, and ordinary CommonJS `require` calls are outside this rule.
 * This rule has no options.
 *
 * @module
 */

import {
  defineProjectRule,
  InternalLeakKinds
} from "agentic-gate-engine";


type InternalLeakContext =
  | {
    kind: typeof InternalLeakKinds.MODULE_REFERENCE;
    specifier: string;
    modulePath: string;
  }
  | {
    kind: typeof InternalLeakKinds.REDUNDANT_MODULE_DIRECTORY;
    directory: string;
    replacement: string;
  }
  | {
    kind: typeof InternalLeakKinds.PACKAGE_EXPORT;
    target: string;
  };

function leakMessage(leak: InternalLeakContext): string {
  if (leak.kind === InternalLeakKinds.MODULE_REFERENCE) {
    return `Local reference '${leak.specifier}' leaks internals from module '${leak.modulePath}'.`;
  }
  if (leak.kind === InternalLeakKinds.PACKAGE_EXPORT) {
    return `Package export target '${leak.target}' leaks a module implementation file.`;
  }
  return `Source directory '${leak.directory}' contains only an index file and does not define a directory module.`;
}

function leakInstruction(leak: InternalLeakContext): string {
  if (leak.kind === InternalLeakKinds.MODULE_REFERENCE) {
    return `Expose the required symbol from '${leak.modulePath}' and import that module directory.`;
  }
  if (leak.kind === InternalLeakKinds.PACKAGE_EXPORT) {
    return `Replace '${leak.target}' with that module's index and re-export its public API there.`;
  }
  return `Replace the index-only directory with the named single-file interface '${leak.replacement}' and update its references.`;
}

/** @hidden */
export default defineProjectRule<InternalLeakContext>(import.meta.url, {
  engine: "module-boundaries",
  message: leakMessage,
  instruction: leakInstruction
});
