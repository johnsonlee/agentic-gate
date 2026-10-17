package io.johnsonlee.agentic.gate

/** Built-in, non-negotiable JVM rules injected by the Gradle composition root. */
public class AgenticGateRules : GateRuleRegistry() {
    override val rules: List<GateRule> = listOf(
        GateRule(
            issue = NoSilentCatchDetector.ISSUE,
            instruction = "Handle the caught exception explicitly or rethrow it with relevant context.",
        ),
    )
}
