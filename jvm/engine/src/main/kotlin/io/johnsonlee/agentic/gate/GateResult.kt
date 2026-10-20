package io.johnsonlee.agentic.gate

/** Stable decision returned by a JVM gate run. */
public enum class GateDecision {
    PASS,
    BLOCK,
}

/** The complete result of one JVM gate execution. */
public data class GateResult(
    public val violations: List<Violation>,
    public val files: List<String>,
) {
    public val decision: GateDecision
        get() = if (violations.isEmpty()) GateDecision.PASS else GateDecision.BLOCK

    public val passed: Boolean
        get() = decision == GateDecision.PASS
}
