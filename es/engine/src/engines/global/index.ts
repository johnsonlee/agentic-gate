import type {
  AgenticGateConfig,
  ProjectRule,
  Violation
} from "../../contract";
import { createProjectContext } from "../../project";
import {
  findSourceDuplicates,
  type SourceDuplicateRules
} from "./duplicates.ts";
import { findModuleDependencyCycles } from "./cycles.ts";
import {
  findModuleBoundaryViolations,
  type ModuleBoundaryRules
} from "./module-boundaries.ts";
import { findUnusedCode, type UnusedRules } from "./unused.ts";
import {
  findCrossProjectFileReferences,
  findUnavailableWorkspaceBinaries,
  findWorkspaceBoundaryViolations,
  findWorkspaceDependencyCycles,
  type WorkspaceRules
} from "./workspace.ts";
export { InternalLeakKinds } from "./module-boundaries.ts";
export {
  CrossProjectFileReferenceKinds,
  WorkspaceBoundaryKinds
} from "./workspace.ts";
export type { WorkspaceRules } from "./workspace.ts";

/** Concrete policies injected by the rules layer into analysis engines. */
export interface GlobalRuleSet {
  cycles: ProjectRule<any>;
  duplicates: SourceDuplicateRules;
  moduleBoundaries: ModuleBoundaryRules;
  unused: UnusedRules;
  workspace: WorkspaceRules;
}

/** Runs every project-wide analyzer against one shared project context. */
export async function runGlobalAnalysis(
  cwd: string,
  eslintFiles: string[],
  config: AgenticGateConfig,
  rules: GlobalRuleSet
): Promise<Violation[]> {
  const project = await createProjectContext(cwd, eslintFiles, config.project?.files);
  const groups = await Promise.all([
    findUnusedCode(cwd, eslintFiles, config, rules.unused),
    findSourceDuplicates(project, rules.duplicates),
    findModuleBoundaryViolations(project, rules.moduleBoundaries),
    findModuleDependencyCycles(project, rules.cycles),
    findUnavailableWorkspaceBinaries(cwd, rules.workspace.binaries),
    findWorkspaceBoundaryViolations(project, rules.workspace.boundaries),
    findCrossProjectFileReferences(project, rules.workspace.fileReferences),
    findWorkspaceDependencyCycles(cwd, rules.workspace)
  ]);
  return groups.flat();
}
