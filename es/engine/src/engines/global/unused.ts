import { relative } from "node:path";
import {
  createOptions,
  createSession,
  type Issue,
  type IssueType
} from "knip/session";
import {
  GateConfigValues,
  type AgenticGateConfig,
  type ProjectRule,
  type SourceLocation,
  type Violation,
  createProjectViolation
} from "../../contract";
import { projectRelativePaths } from "../../project";

type MutableProjectConfig = {
  entry?: string[];
  project?: string[];
};

interface UnusedIssueAdapter {
  issueTypes: readonly IssueType[];
  rule: ProjectRule<any>;
  context(issue: Issue): unknown;
}

export interface UnusedRules {
  exports: ProjectRule<any>;
  files: ProjectRule<any>;
  types: ProjectRule<any>;
}

function unusedAdapters(rules: UnusedRules): readonly UnusedIssueAdapter[] {
  return [
  {
    issueTypes: ["files"],
    rule: rules.files,
    context: () => ({})
  },
  {
    issueTypes: ["exports", "nsExports"],
    rule: rules.exports,
    context: symbolContext
  },
  {
    issueTypes: ["types", "nsTypes"],
    rule: rules.types,
    context: symbolContext
  }
  ];
}

function symbolContext({ symbol }: Issue): { symbol: string } {
  return { symbol };
}
function rulesByIssueType(rules: UnusedRules): Map<IssueType, UnusedIssueAdapter> {
  return new Map(
  unusedAdapters(rules).flatMap((adapter) =>
    adapter.issueTypes.map((issueType) => [issueType, adapter] as const)
  )
  );
}

function flattenIssues(records: Record<string, Record<string, Issue>>): Issue[] {
  const issues: Issue[] = [];
  for (const group of Object.values(records)) issues.push(...Object.values(group));
  return issues;
}

function issueLocation(cwd: string, issue: Issue): SourceLocation {
  const file = relative(cwd, issue.filePath);
  const { line, col } = issue;
  if (line === undefined || col === undefined || line <= 0 || col <= 0) return { file };
  return { file, start: { line, column: col } };
}

async function knipOptions(
  cwd: string,
  enabledTypes: IssueType[],
  eslintFiles: string[],
  config: AgenticGateConfig
) {
  const options = await createOptions({
    cwd,
    includedIssueTypes: enabledTypes,
    isSession: true,
    isShowProgress: false,
    isUseTscFiles: config.project?.files === undefined
  });
  const projectConfig = options.parsedConfig as MutableProjectConfig;
  if (config.project?.files === GateConfigValues.ESLINT_INPUT_FILES) {
    projectConfig.project = projectRelativePaths(cwd, eslintFiles);
  } else if (Array.isArray(config.project?.files)) {
    projectConfig.project = config.project.files;
  }
  if (Array.isArray(config.project?.entries)) projectConfig.entry = config.project.entries;
  return options;
}

/**
 * Finds files, exports, and types that are unreachable from the project's
 * discovered or configured entry points.
 */
export async function findUnusedCode(
  cwd: string,
  eslintFiles: string[],
  config: AgenticGateConfig,
  rules: UnusedRules
): Promise<Violation[]> {
  const adapters = rulesByIssueType(rules);
  const supportedIssueTypes = [...adapters.keys()];
  const session = await createSession(
    await knipOptions(cwd, supportedIssueTypes, eslintFiles, config)
  );
  const result = session.getResults();
  if (result.hasConfigLoadErrors) {
    throw new Error("Knip could not load the project configuration.");
  }

  const violations: Violation[] = [];
  for (const type of supportedIssueTypes) {
    const adapter = adapters.get(type);
    if (!adapter) throw new Error(`Missing Knip issue policy '${type}'.`);
    for (const issue of flattenIssues(result.issues[type])) {
      violations.push(createProjectViolation(
        adapter.rule,
        adapter.context(issue),
        issueLocation(cwd, issue),
        {
          ruleId: `knip/${issue.type}`,
          symbol: issue.symbol || undefined
        }
      ));
    }
  }
  return violations;
}
