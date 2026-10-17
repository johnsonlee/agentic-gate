import type {
  JSRuleDefinition,
  JSRuleDefinitionTypeOptions
} from "eslint";
import {
  type AgenticGateRuleId,
  ruleIdFromUrl,
  ruleNameFromId,
  ruleNameFromUrl
} from "agentic-gate-engine";

/**
 * An ESLint rule with the stable metadata needed to turn a diagnostic into
 * actionable Agentic Gate feedback.
 */
export type AgenticGateRule<
  Options extends Partial<JSRuleDefinitionTypeOptions> = {}
> = JSRuleDefinition<Options> & {
  agenticGate: {
    ruleId: AgenticGateRuleId;
    feedbackFormat: "eslint-lint-message";
    messageIds: readonly string[];
  };
};

/**
 * Defines a native rule whose public identity comes from its source filename.
 * `moduleUrl` must be the calling module's `import.meta.url` so the same name
 * is used for the ESLint rule ID, Agentic Gate check ID, and source URL.
 */
export function defineRule<
  Options extends Partial<JSRuleDefinitionTypeOptions>
>(
  moduleUrl: string,
  definition: JSRuleDefinition<Options>
): AgenticGateRule<Options> {
  const meta = definition.meta;
  if (!meta?.messages) {
    throw new Error("An Agentic Gate rule must declare meta.messages.");
  }

  const name = ruleNameFromUrl(moduleUrl);

  return {
    ...definition,
    meta: {
      ...meta,
      docs: {
        ...meta.docs,
        url: `https://github.com/johnsonlee/agentic-gate/blob/main/es/rules/src/rules/unit/${name}.ts`
      }
    },
    agenticGate: {
      ruleId: ruleIdFromUrl(moduleUrl),
      feedbackFormat: "eslint-lint-message",
      messageIds: Object.keys(meta.messages)
    }
  };
}

/**
 * Indexes native rules by the names already derived from their source files.
 */
export function defineRules(
  rules: readonly AgenticGateRule<any>[]
): Record<string, AgenticGateRule<any>> {
  const indexed: Record<string, AgenticGateRule<any>> = {};
  for (const rule of rules) {
    const name = ruleNameFromId(rule.agenticGate.ruleId);
    if (indexed[name]) {
      throw new Error(`Duplicate native rule '${name}'.`);
    }
    indexed[name] = rule;
  }
  return indexed;
}
