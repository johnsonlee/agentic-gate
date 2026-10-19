#!/usr/bin/env bun

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { GateDecisions } from "agentic-gate-engine";
import { formatHuman, formatJson } from "./output.ts";
import { runGate } from "./runner.ts";

const NODE_ARGUMENT_OFFSET = 2;
const EXECUTION_FAILURE_EXIT_CODE = 2;
const OutputFormats = {
  HUMAN: "human",
  JSON: "json"
} as const;

const help = `Usage: agentic-gate-cli [options] [file|dir|glob ...]

Options:
  --cwd <path>       Project directory (default: current directory)
  --config <path>    Agentic Gate config file
  --format <format>  human or json (default: human)
  --help             Show this help
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(NODE_ARGUMENT_OFFSET),
    allowPositionals: true,
    strict: true,
    options: {
      cwd: { type: "string" },
      config: { type: "string" },
      format: { type: "string", default: OutputFormats.HUMAN },
      help: { type: "boolean", default: false }
    }
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  if (values.format !== OutputFormats.HUMAN && values.format !== OutputFormats.JSON) {
    throw new Error("--format must be 'human' or 'json'.");
  }

  const result = await runGate({
    cwd: resolve(values.cwd ?? process.cwd()),
    patterns: positionals.length ? positionals : undefined,
    configFile: values.config
  });
  const output = values.format === OutputFormats.JSON ? formatJson(result) : formatHuman(result);
  process.stdout.write(output + "\n");
  process.exitCode = result.decision === GateDecisions.PASS ? 0 : 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Agentic Gate failed: ${message}` + "\n");
  process.exitCode = EXECUTION_FAILURE_EXIT_CODE;
});
