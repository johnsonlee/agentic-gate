import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  GateConfigValues,
  JavaScriptValueTypes,
  type AgenticGateConfig,
  type LoadedGateConfig
} from "agentic-gate-engine";

export type {
  AgenticGateConfig,
  LoadedGateConfig
} from "agentic-gate-engine";

const configFileNames = [
  "gate.config.ts",
  "gate.config.mts",
  "gate.config.js",
  "gate.config.mjs"
] as const;
const FILE_NOT_FOUND_ERROR = "ENOENT";
const rootConfigKeys = new Set(["eslint", "project"]);
const eslintConfigKeys = new Set(["targets", "configFile"]);
const projectConfigKeys = new Set(["files", "entries"]);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === FILE_NOT_FOUND_ERROR) return false;
    throw error;
  }
}

function configRecord(value: unknown, path: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== JavaScriptValueTypes.OBJECT ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  keys: ReadonlySet<string>,
  path: string
): void {
  const unknown = Object.keys(value).filter((key) => !keys.has(key));
  if (unknown.length > 0) {
    throw new TypeError(`${path} contains unsupported field(s): ${unknown.join(", ")}.`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== JavaScriptValueTypes.STRING)) {
    throw new TypeError(`${path} must be an array of strings.`);
  }
}

function validateGateConfig(value: unknown, filePath: string): AgenticGateConfig {
  const config = configRecord(value, filePath);
  assertKnownKeys(config, rootConfigKeys, filePath);

  if (config.eslint !== undefined) {
    const eslintPath = `${filePath}#eslint`;
    const eslint = configRecord(config.eslint, eslintPath);
    assertKnownKeys(eslint, eslintConfigKeys, eslintPath);
    if (eslint.targets !== undefined) {
      assertStringArray(eslint.targets, `${filePath}#eslint.targets`);
    }
    if (
      eslint.configFile !== undefined &&
      typeof eslint.configFile !== JavaScriptValueTypes.STRING
    ) {
      throw new TypeError(`${filePath}#eslint.configFile must be a string.`);
    }
  }

  if (config.project !== undefined) {
    const projectPath = `${filePath}#project`;
    const project = configRecord(config.project, projectPath);
    assertKnownKeys(project, projectConfigKeys, projectPath);
    if (
      project.files !== undefined &&
      project.files !== GateConfigValues.ESLINT_INPUT_FILES
    ) {
      assertStringArray(project.files, `${filePath}#project.files`);
    }
    if (
      project.entries !== undefined &&
      project.entries !== GateConfigValues.AUTO_ENTRIES
    ) {
      assertStringArray(project.entries, `${filePath}#project.entries`);
    }
  }

  return config as AgenticGateConfig;
}

/**
 * Loads an explicitly requested config or the single supported
 * `gate.config.*` file in the project root.
 */
export async function loadGateConfig(
  cwd: string,
  requestedPath?: string
): Promise<LoadedGateConfig> {
  const candidates = requestedPath
    ? isAbsolute(requestedPath)
      ? [requestedPath]
      : [resolve(cwd, requestedPath)]
    : configFileNames.map((name) => resolve(cwd, name));

  const discovered = (await Promise.all(
    candidates.map(async (filePath) => ({ filePath, exists: await fileExists(filePath) }))
  )).filter(({ exists }) => exists).map(({ filePath }) => filePath);
  if (discovered.length > 1) {
    throw new Error(`Multiple Agentic Gate config files found: ${discovered.join(", ")}.`);
  }
  const [filePath] = discovered;
  if (filePath) {
    const module = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
    return { config: validateGateConfig(module.default, filePath), filePath };
  }

  if (requestedPath) {
    throw new Error(`Agentic Gate config not found: ${requestedPath}`);
  }
  return { config: {} };
}
