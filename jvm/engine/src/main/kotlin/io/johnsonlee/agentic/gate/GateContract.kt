package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.IssueRegistry
import com.android.tools.lint.client.api.Vendor
import com.android.tools.lint.detector.api.CURRENT_API
import com.android.tools.lint.detector.api.Issue
import java.io.File

/** A source position exposed to coding agents. Lines and columns are one-based. */
public data class SourcePosition(
    public val line: Int,
    public val column: Int,
)

/** The source range attached to a [Violation]. */
public data class SourceLocation(
    public val file: String,
    public val start: SourcePosition?,
    public val end: SourcePosition?,
)

/** Stable analyzer identity exposed in violation evidence. */
public enum class GateEngine {
    ANDROID_LINT,
}

/** Analyzer identity retained so a violation remains traceable to its source. */
public data class ViolationEvidence(
    public val engine: GateEngine,
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

/** Exact inputs for one JVM analysis. Rules have no configurable behavior. */
public data class GateRequest(
    public val projectDirectory: File,
    public val sourceFiles: Set<File>,
    public val classDirectories: Set<File> = emptySet(),
    public val libraries: Set<File> = emptySet(),
)

/** One Android Lint issue and the repair instruction returned to an agent. */
public data class GateRule(
    public val issue: Issue,
    public val instruction: String,
)

/**
 * Injection boundary between the engine and concrete JVM rules.
 *
 * The engine depends only on this registry. The Gradle composition root loads
 * the concrete rules project and injects it when the gate task executes.
 */
public abstract class GateRuleRegistry : IssueRegistry() {
    public abstract val rules: List<GateRule>

    final override val issues: List<Issue>
        get() = rules.map(GateRule::issue)

    final override val api: Int = CURRENT_API

    final override val minApi: Int = CURRENT_API

    final override val vendor: Vendor = Vendor(
        vendorName = "Agentic Gate",
        identifier = "io.johnsonlee.agentic.gate",
        feedbackUrl = "https://github.com/johnsonlee/agentic-gate/issues",
        contact = "https://github.com/johnsonlee/agentic-gate",
    )

    internal fun feedbackFor(issue: Issue): ActionableFeedback {
        val rule = rules.single { candidate -> candidate.issue.id == issue.id }
        return ActionableFeedback(
            instruction = rule.instruction,
            verification = "Run Agentic Gate again and confirm '${issue.id}' no longer reports this item.",
        )
    }
}
