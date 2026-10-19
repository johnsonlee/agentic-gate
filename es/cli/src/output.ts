import { GateDecisions, type GateResult } from "agentic-gate-engine";

const JSON_INDENT_SPACES = 2;

/** Formats a gate result for a person or coding agent reading terminal output. */
export function formatHuman(result: GateResult): string {
  if (result.decision === GateDecisions.PASS) {
    return `PASS ${result.files.length} files checked`;
  }
  const violations = result.violations.map((violation) => {
    const location = violation.location.start
      ? `:${violation.location.start.line}:${violation.location.start.column}`
      : "";
    const visualization = violation.visualization
      ? "\n\n```" + violation.visualization.format + "\n" +
        violation.visualization.source + "\n```"
      : "";
    return `${violation.location.file}${location} [${violation.check}] ${violation.message}` +
      "\n  Fix: " + violation.remediation.instruction + visualization;
  });
  return [
    `BLOCK ${result.summary.total} violations (${result.summary.eslint} ESLint, ${result.summary.project} project)`,
    ...violations
  ].join("\n");
}

/** Serializes the complete gate result for programmatic agent integrations. */
export function formatJson(result: GateResult): string {
  return JSON.stringify(result, null, JSON_INDENT_SPACES);
}
