import type { AgenticGateConfig } from "agentic-gate-cli";

export default {
  eslint: {
    targets: ["."]
  },
  project: {
    files: "eslint-input",
    entries: [
      "gate.config.ts",
      "eslint.config.mjs",
      "tooling/docs.ts",
      "es/engine/src/index.ts",
      "es/rules/src/index.ts",
      "es/rules/tests/*.test.ts",
      "es/cli/src/index.ts",
      "es/cli/src/cli.ts",
      "es/cli/tests/*.test.ts",
      "es/cli/smoke/**/*.mjs",
      "es/cli/build.ts",
      "examples/es-runner/eslint.config.mjs",
      "examples/es-runner/gate.config.ts",
      "examples/es-runner/src/index.ts"
    ]
  }
} satisfies AgenticGateConfig;
