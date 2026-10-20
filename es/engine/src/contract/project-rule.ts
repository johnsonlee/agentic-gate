import type {
  GateEngine,
  SourceLocation,
  Violation
} from "./gate.ts";
import { type AgenticGateRuleId, ruleIdFromUrl, verificationMessage } from "./rule.ts";

export interface ProjectRule<Context> {
  agenticGate: {
    ruleId: AgenticGateRuleId;
    engine: GateEngine;
  };
  message(context: Context): string;
  instruction(context: Context): string;
}

interface ProjectEvidence {
  ruleId?: string;
  messageId?: string;
  symbol?: string;
}

/** Defines a project rule whose public ID comes from its source filename. */
export function defineProjectRule<Context>(
  moduleUrl: string,
  definition: Omit<ProjectRule<Context>, "agenticGate"> & { engine: GateEngine }
): ProjectRule<Context> {
  const { engine, ...feedback } = definition;
  return {
    ...feedback,
    agenticGate: {
      ruleId: ruleIdFromUrl(moduleUrl),
      engine
    }
  };
}

/** Converts an engine finding into the shared actionable violation contract. */
export function createProjectViolation<Context>(
  rule: ProjectRule<Context>,
  context: Context,
  location: SourceLocation,
  evidence: ProjectEvidence = {}
): Violation {
  const check = rule.agenticGate.ruleId;
  return {
    check,
    message: rule.message(context),
    location,
    evidence: {
      engine: rule.agenticGate.engine,
      ruleId: evidence.ruleId ?? check,
      messageId: evidence.messageId,
      symbol: evidence.symbol
    },
    remediation: {
      instruction: rule.instruction(context),
      verification: verificationMessage(check, "this item")
    }
  };
}
