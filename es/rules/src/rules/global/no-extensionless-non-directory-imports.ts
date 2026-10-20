/**
 * Makes the target kind of every relative source reference explicit.
 *
 * An extensionless relative reference is valid only when it resolves to a
 * directory module's public `index.*` interface. References to concrete source
 * files include the actual extension, such as `./status.ts` or `./view.tsx`.
 * Extensionless references to ordinary directories or unresolved targets are
 * also blocked. This lets a reader identify every directory-module import from
 * the statement alone.
 *
 * TypeScript rewrites `.ts` and `.tsx` to JavaScript extensions during emit, so
 * source code never names a future build artifact. This rule has no options.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface ExtensionlessNonDirectoryImportContext {
  specifier: string;
  explicitSpecifier?: string;
}

/** @hidden */
export default defineProjectRule<ExtensionlessNonDirectoryImportContext>(import.meta.url, {
  engine: "module-boundaries",
  message: ({ specifier, explicitSpecifier }) => {
    const resolution = explicitSpecifier
      ? `resolves to a file; use '${explicitSpecifier}'.`
      : "does not resolve to a directory module.";
    return `Extensionless relative reference '${specifier}' ${resolution}`;
  },
  instruction: ({ explicitSpecifier }) => explicitSpecifier
    ? `Replace the reference with '${explicitSpecifier}'.`
    : "Reference a directory module with an index interface, or name the concrete source file with its actual extension."
});
