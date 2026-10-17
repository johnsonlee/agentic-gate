import type { AgenticGateConfig } from "agentic-gate-cli";

export default {
  eslint: {
    targets: ["src"]
  },
  project: {
    files: "eslint-input",
    entries: ["src/index.ts"]
  }
} satisfies AgenticGateConfig;
