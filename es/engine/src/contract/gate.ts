/** Stable analyzer identities exposed in violation evidence. */
export const GateEngines = {
  ESLINT: "eslint",
  KNIP: "knip",
  MODULE_DEPENDENCIES: "module-dependencies",
  MODULE_BOUNDARIES: "module-boundaries",
  SOURCE_DUPLICATES: "source-duplicates",
  WORKSPACE_BINARIES: "workspace-binaries",
  WORKSPACE_BOUNDARIES: "workspace-boundaries",
  WORKSPACE_DEPENDENCIES: "workspace-dependencies"
} as const;

/** Analyzer implementation that produced a violation's supporting evidence. */
export type GateEngine = typeof GateEngines[keyof typeof GateEngines];

/** Stable outcomes returned by every gate run. */
export const GateDecisions = {
  PASS: "pass",
  BLOCK: "block"
} as const;

/** Instructions a coding agent can execute and then verify. */
export interface ActionableFeedback {
  /** Concrete change that should resolve the violation. */
  instruction: string;
  /** Check that confirms the change resolved the violation. */
  verification: string;
}

/** Line and column coordinates within a source file. */
export interface SourcePosition {
  line: number;
  column: number;
}

/** File and optional source range associated with a violation. */
export interface SourceLocation {
  file: string;
  start?: SourcePosition;
  end?: SourcePosition;
}

/** A machine-readable visualization that can also be rendered for a person. */
export interface ViolationVisualization {
  format: "mermaid";
  kind: "flowchart";
  source: string;
}

/**
 * A quality-policy failure normalized across file-local and project analyzers.
 * Every violation explains what failed, where it failed, why it was reported,
 * and how a coding agent can resolve it.
 */
export interface Violation {
  /** Stable policy identifier, such as `agentic-gate/no-unused-exports`. */
  check: string;
  /** Human-readable explanation of the failure. */
  message: string;
  /**
   * Source location reported by the analyzer. Project-wide findings may only
   * identify a file when no truthful line or column is available.
   */
  location: SourceLocation;
  /** Analyzer-specific identity retained for traceability and debugging. */
  evidence: {
    engine: GateEngine;
    ruleId: string;
    messageId?: string;
    symbol?: string;
  };
  /** Supporting graph emitted when relationships are essential to the finding. */
  visualization?: ViolationVisualization;
  /** Required repair instructions exposed to the coding agent. */
  remediation: ActionableFeedback;
}

/** Aggregate result returned by the runner and serialized by the CLI. */
export interface GateResult {
  /** `block` exactly when one or more violations are present. */
  decision: typeof GateDecisions[keyof typeof GateDecisions];
  violations: Violation[];
  /** Project-relative paths checked during this run. */
  files: string[];
  /** Violation counts by analyzer scope and in total. */
  summary: {
    eslint: number;
    project: number;
    total: number;
  };
}
