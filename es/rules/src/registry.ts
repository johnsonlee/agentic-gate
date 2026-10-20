import type { GateRuleSet } from "agentic-gate-engine";
import agenticGateEslint from "./eslint";
import {
  noCrossProjectFileReferences,
  noDuplicatedConstantsInModule,
  noDuplicatedFunctions,
  noDuplicatedStatements,
  noDuplicatedTemplateLiteralFragments,
  noExtensionlessNonDirectoryImports,
  noModuleDependencyCycles,
  noModuleInternalLeaks,
  noUnusedExports,
  noUnusedFiles,
  noUnusedTypes,
  noUnavailableWorkspaceBinaries,
  noWorkspaceDependencyCycles,
  noWorkspaceInternalLeaks
} from "./rules";

/**
 * Creates the complete non-negotiable policy bundle injected into the engine.
 *
 * The top-level runner is the composition root: it creates this bundle and
 * passes it into the engine. The engine controls execution through rule
 * contracts without importing concrete policy implementations. See the
 * workspace architecture module for the layer model and exact relationship
 * criteria used by the global workspace checks.
 */
export function createGateRules(): GateRuleSet {
  return {
    eslint: agenticGateEslint.configs.gate,
    project: {
      cycles: noModuleDependencyCycles,
      duplicates: {
        constantsInModule: noDuplicatedConstantsInModule,
        functions: noDuplicatedFunctions,
        statements: noDuplicatedStatements,
        templateLiteralFragments: noDuplicatedTemplateLiteralFragments
      },
      moduleBoundaries: {
        extensionlessReferences: noExtensionlessNonDirectoryImports,
        internalLeaks: noModuleInternalLeaks
      },
      unused: {
        exports: noUnusedExports,
        files: noUnusedFiles,
        types: noUnusedTypes
      },
      workspace: {
        binaries: noUnavailableWorkspaceBinaries,
        boundaries: noWorkspaceInternalLeaks,
        cycles: noWorkspaceDependencyCycles,
        fileReferences: noCrossProjectFileReferences
      }
    }
  };
}
