import type { Linter } from "eslint";
import {
  GateDecisions,
  type AgenticGateConfig,
  type GateResult,
  type Violation
} from "./contract";
import {
  runEslint,
  runGlobalAnalysis,
  type EslintGateResult,
  type GlobalRuleSet
} from "./engines";
import { projectRelativePaths } from "./project";

/** Concrete policies supplied by the outer composition root. */
export interface GateRuleSet {
  eslint: Linter.Config[];
  project: GlobalRuleSet;
}

function sortViolations(violations: Violation[]): Violation[] {
  return violations.sort((left, right) =>
    left.location.file.localeCompare(right.location.file) ||
    (left.location.start?.line ?? 0) - (right.location.start?.line ?? 0) ||
    left.check.localeCompare(right.check)
  );
}

function gateResult(
  cwd: string,
  eslint: EslintGateResult,
  projectViolations: Violation[]
): GateResult {
  const violations = sortViolations([
    ...eslint.violations,
    ...projectViolations
  ]);
  return {
    decision: violations.length === 0 ? GateDecisions.PASS : GateDecisions.BLOCK,
    violations,
    files: projectRelativePaths(cwd, eslint.files),
    summary: {
      eslint: eslint.violations.length,
      project: projectViolations.length,
      total: violations.length
    }
  };
}

/** Controls the complete ES analysis flow using rules injected by the runner. */
export async function runGateEngine(
  cwd: string,
  patterns: string[],
  config: AgenticGateConfig,
  rules: GateRuleSet
): Promise<GateResult> {
  const eslint = await runEslint(cwd, patterns, config, rules.eslint);
  const projectViolations = await runGlobalAnalysis(
    cwd,
    eslint.files,
    config,
    rules.project
  );
  return gateResult(cwd, eslint, projectViolations);
}
