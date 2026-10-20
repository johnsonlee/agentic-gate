package io.johnsonlee.agentic.gate

/** Built-in, non-negotiable JVM rules injected by the Gradle composition root. */
public class AgenticGateRuleRegistry : GateRuleRegistry {
    override val rules: List<GateRule> = ruleDefinitions.map { definition ->
        GateRule(
            id = definition.issue.id,
            instruction = definition.remediation,
            definition = definition.issue,
        )
    }
}
