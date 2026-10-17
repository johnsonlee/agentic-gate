import { isAbsolute, relative, resolve, sep } from "node:path";
import typescriptParser from "@typescript-eslint/parser";
import { ESLint, type Linter } from "eslint";
import {
  type AgenticGateConfig,
  type Violation,
  verificationMessage
} from "../contract";
import { PathSegments } from "../project";

/** File-local violations and the concrete files evaluated by ESLint. */
export interface EslintGateResult {
  violations: Violation[];
  files: string[];
}

function belongsToProject(cwd: string, file: string): boolean {
  const projectPath = relative(cwd, file);
  return projectPath !== PathSegments.PARENT_DIRECTORY &&
    !projectPath.startsWith(`${PathSegments.PARENT_DIRECTORY}${sep}`) &&
    !isAbsolute(projectPath);
}

/** Runs the project's ESLint config with the blocking Agentic Gate overlay. */
export async function runEslint(
  cwd: string,
  patterns: string[],
  config: AgenticGateConfig,
  gateConfig: Linter.Config[]
): Promise<EslintGateResult> {
  const configuredFile = config.eslint?.configFile;
  const configProbe = new ESLint({ cwd });
  const probedFile = configuredFile === undefined
    ? await configProbe.findConfigFile()
    : undefined;
  const discoveredFile = configuredFile === false
    ? undefined
    : configuredFile
      ? (isAbsolute(configuredFile) ? configuredFile : resolve(cwd, configuredFile))
      : probedFile && belongsToProject(cwd, probedFile)
        ? probedFile
        : undefined;

  const typescriptConfig: Linter.Config = {
    name: "agentic-gate/typescript-parser",
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: { parser: typescriptParser }
  };

  const eslint = new ESLint({
    cwd,
    baseConfig: [typescriptConfig],
    overrideConfig: gateConfig,
    ...(discoveredFile
      ? (configuredFile ? { overrideConfigFile: discoveredFile } : {})
      : { overrideConfigFile: true }),
    errorOnUnmatchedPattern: true,
    warnIgnored: false
  });
  const results = await eslint.lintFiles(patterns);
  const violations = results.flatMap((result) =>
    result.messages
      .filter((message) => message.severity > 0)
      .map((message): Violation => {
        const ruleId = message.ruleId ?? "eslint/parse-error";
        const instruction = message.suggestions?.[0]?.desc ??
          `Fix the '${ruleId}' violation: ${message.message}`;
        return {
          check: ruleId,
          message: message.message,
          location: {
            file: relative(cwd, result.filePath),
            start: {
              line: message.line,
              column: message.column
            },
            ...(message.endLine !== undefined && message.endColumn !== undefined
              ? {
                  end: {
                    line: message.endLine,
                    column: message.endColumn
                  }
                }
              : {})
          },
          evidence: {
            engine: "eslint",
            ruleId,
            messageId: message.messageId
          },
          remediation: {
            instruction,
            verification: verificationMessage(ruleId, "at this location")
          }
        };
      })
  );

  return {
    violations,
    files: results.map((result) => result.filePath)
  };
}
