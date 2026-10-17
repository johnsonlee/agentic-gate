import type { AgenticGateConfig } from "agentic-gate-cli";

export default {
  eslint: { targets: ["src"] },
  project: {
    files: ["src/**/*.ts"],
    entries: ["src/index.ts"]
  }
} satisfies AgenticGateConfig;
