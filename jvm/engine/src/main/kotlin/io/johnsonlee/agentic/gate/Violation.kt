package io.johnsonlee.agentic.gate

/** Rule identity retained so a violation remains traceable to its source. */
public data class ViolationEvidence(
    public val ruleId: String,
)

/** Concrete repair and verification steps that a coding agent can execute. */
public data class ActionableFeedback(
    public val instruction: String,
    public val verification: String,
)

/** A blocking finding normalized for a coding agent. */
public data class Violation(
    public val check: String,
    public val message: String,
    public val location: SourceLocation,
    public val evidence: ViolationEvidence,
    public val remediation: ActionableFeedback,
)
