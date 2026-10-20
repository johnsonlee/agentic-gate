import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const RULE_ID_PREFIX = "agentic-gate/";

export type AgenticGateRuleId = `${typeof RULE_ID_PREFIX}${string}`;

/** Derives a stable public rule name from a `no-*.ts` source filename. */
export function ruleNameFromUrl(moduleUrl: string): string {
  const file = basename(fileURLToPath(moduleUrl));
  const name = basename(file, extname(file));
  if (!/^no-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Rule filename '${file}' must use a no-kebab-case name.`);
  }
  return name;
}

/** Derives the public Agentic Gate rule ID from its source filename. */
export function ruleIdFromUrl(moduleUrl: string): AgenticGateRuleId {
  return ruleIdFromName(ruleNameFromUrl(moduleUrl));
}

/** Builds a public Agentic Gate rule ID from an already-derived rule name. */
export function ruleIdFromName(ruleName: string): AgenticGateRuleId {
  return `${RULE_ID_PREFIX}${ruleName}`;
}

/** Extracts the filename-derived rule name from a public rule ID. */
export function ruleNameFromId(ruleId: AgenticGateRuleId): string {
  return ruleId.slice(RULE_ID_PREFIX.length);
}

/** Builds the command-level verification attached to actionable feedback. */
export function verificationMessage(ruleId: string, target: string): string {
  return `Run Agentic Gate again and confirm '${ruleId}' no longer reports ${target}.`;
}
