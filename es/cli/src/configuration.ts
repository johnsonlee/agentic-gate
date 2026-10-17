import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === FILE_NOT_FOUND_ERROR) return false;
    throw error;
  }
}

/**
 * Loads an explicitly requested config or discovers the first supported
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

  for (const filePath of candidates) {
    if (!(await fileExists(filePath))) continue;
    const module = await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`);
    const config = module.default as AgenticGateConfig | undefined;
    if (!config || typeof config !== JavaScriptValueTypes.OBJECT) {
      throw new TypeError(`${filePath} must default-export an Agentic Gate config object.`);
    }
    return { config, filePath };
  }

  if (requestedPath) {
    throw new Error(`Agentic Gate config not found: ${requestedPath}`);
  }
  return { config: {} };
}
