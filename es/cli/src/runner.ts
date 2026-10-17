import { resolve } from "node:path";
import {
  type AgenticGateConfig,
  type GateResult,
  runGateEngine
} from "agentic-gate-engine";
import { createGateRules } from "agentic-gate-rules";
import { loadGateConfig } from "./configuration.ts";

/** Inputs accepted by the programmatic Agentic Gate runner. */
export interface RunGateOptions {
  cwd?: string;
  patterns?: string[];
  config?: AgenticGateConfig;
  configFile?: string;
}

/** Loads project configuration and evaluates every ES gate policy. */
export async function runGate(options: RunGateOptions = {}): Promise<GateResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const loaded = options.config
    ? { config: options.config }
    : await loadGateConfig(cwd, options.configFile);
  const patterns = options.patterns?.length
    ? options.patterns
    : loaded.config.eslint?.targets?.length
      ? loaded.config.eslint.targets
      : ["."];
  return runGateEngine(cwd, patterns, loaded.config, createGateRules());
}
