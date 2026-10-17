import { describe, expect, it } from "bun:test";
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
} from "../src";

const knipRules = [noUnusedFiles, noUnusedExports, noUnusedTypes];
const FragmentRepetitions = 20;

describe("project rule registry", () => {
  it("derives every public check ID from its rule filename", () => {
    expect([
      noCrossProjectFileReferences,
      noDuplicatedConstantsInModule,
      noDuplicatedFunctions,
      noDuplicatedStatements,
      noDuplicatedTemplateLiteralFragments,
      noExtensionlessNonDirectoryImports,
      noModuleDependencyCycles,
      noModuleInternalLeaks,
      noUnavailableWorkspaceBinaries,
      noWorkspaceDependencyCycles,
      noWorkspaceInternalLeaks,
      ...knipRules
    ].map((rule) => rule.agenticGate.ruleId)).toEqual([
      "agentic-gate/no-cross-project-file-references",
      "agentic-gate/no-duplicated-constants-in-module",
      "agentic-gate/no-duplicated-functions",
      "agentic-gate/no-duplicated-statements",
      "agentic-gate/no-duplicated-template-literal-fragments",
      "agentic-gate/no-extensionless-non-directory-imports",
      "agentic-gate/no-module-dependency-cycles",
      "agentic-gate/no-module-internal-leaks",
      "agentic-gate/no-unavailable-workspace-binaries",
      "agentic-gate/no-workspace-dependency-cycles",
      "agentic-gate/no-workspace-internal-leaks",
      "agentic-gate/no-unused-files",
      "agentic-gate/no-unused-exports",
      "agentic-gate/no-unused-types"
    ]);
  });

  it("renders duplicate source references without inventing a line", () => {
    expect(noDuplicatedConstantsInModule.message({
      label: "second",
      originalLabel: "first",
      originalLocation: "src/constants.ts"
    })).toContain("at src/constants.ts.");
    expect(noDuplicatedFunctions.message({
      label: "second",
      originalLabel: "first",
      originalLocation: "src/functions.ts"
    })).toContain("at src/functions.ts.");
    expect(noDuplicatedStatements.message({
      label: "second",
      originalLabel: "first",
      originalLocation: "src/statements.ts"
    })).toContain("at src/statements.ts.");
    expect(noDuplicatedTemplateLiteralFragments.message({
      fragment: "fragment".repeat(FragmentRepetitions),
      originalLocation: "src/templates.ts"
    })).toContain(`fragment ${JSON.stringify("fragment".repeat(FragmentRepetitions))}`);
  });

});
