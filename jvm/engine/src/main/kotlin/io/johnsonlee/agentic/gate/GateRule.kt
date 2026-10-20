package io.johnsonlee.agentic.gate

/**
 * One non-negotiable JVM policy and its repair instruction.
 *
 * [definition] is an opaque engine input. Keeping it behind this contract lets
 * the engine change its analysis implementation without changing rule callers.
 */
public class GateRule(
    public val id: String,
    public val instruction: String,
    definition: Any,
) {
    private val definition: Any = definition

    internal fun engineDefinition(): Any = definition
}

/** Injection boundary between the engine and concrete JVM policies. */
public interface GateRuleRegistry {
    public val rules: List<GateRule>
}

internal fun GateRuleRegistry.feedbackFor(ruleId: String): ActionableFeedback {
    val rule = rules.single { candidate -> candidate.id == ruleId }
    return ActionableFeedback(
        instruction = rule.instruction,
        verification = "Run Agentic Gate again and confirm '$ruleId' no longer reports this item.",
    )
}
