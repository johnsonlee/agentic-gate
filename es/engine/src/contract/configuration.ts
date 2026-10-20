/** Supported project-discovery modes. */
export const GateConfigValues = {
  AUTO_ENTRIES: "auto",
  ESLINT_INPUT_FILES: "eslint-input"
} as const;

/** Project-wide options read from `gate.config.ts`. */
export interface AgenticGateConfig {
  eslint?: {
    targets?: string[];
    configFile?: string;
  };
  project?: {
    files?: typeof GateConfigValues.ESLINT_INPUT_FILES | string[];
    entries?: typeof GateConfigValues.AUTO_ENTRIES | string[];
  };
}

/** A resolved gate configuration and the file that supplied it, when present. */
export interface LoadedGateConfig {
  config: AgenticGateConfig;
  filePath?: string;
}
