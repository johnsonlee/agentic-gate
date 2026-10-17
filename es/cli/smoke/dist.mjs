import { resolve } from "node:path";
import { agenticGateEslint } from "../../rules/dist/index.js";
import {
  GateDecisions,
  ruleIdFromName,
  runGate
} from "../dist/index.js";

const EXPECTED_CLEAN_FILE_COUNT = 2;
const EXPECTED_BINARY_OUTPUT = "PASS 2 files checked";

for (const [name, rule] of Object.entries(agenticGateEslint.rules)) {
  if (rule?.agenticGate.ruleId !== ruleIdFromName(name)) {
    throw new Error(`Built rule '${name}' did not retain its filename-derived ID.`);
  }
}

const result = await runGate({
  cwd: resolve(import.meta.dirname, "../tests/fixtures/clean"),
  patterns: ["src"],
  config: {
    project: {
      files: ["src/**/*.ts"],
      entries: ["src/index.ts"]
    }
  }
});

if (result.decision !== GateDecisions.PASS || result.files.length !== EXPECTED_CLEAN_FILE_COUNT) {
  throw new Error("The built runner did not pass the clean fixture.");
}

const binary = resolve(import.meta.dirname, "../dist/agentic-gate-cli");
const fixture = resolve(import.meta.dirname, "../tests/fixtures/clean");
const binaryResult = Bun.spawnSync([binary, "--cwd", fixture]);
const binaryOutput = binaryResult.stdout.toString().trim();
if (binaryResult.exitCode !== 0 || binaryOutput !== EXPECTED_BINARY_OUTPUT) {
  throw new Error(
    `The compiled CLI failed its smoke test: ${binaryResult.stderr.toString().trim()}`
  );
}
