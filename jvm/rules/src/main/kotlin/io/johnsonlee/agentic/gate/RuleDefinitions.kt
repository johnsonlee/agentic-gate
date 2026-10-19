package io.johnsonlee.agentic.gate

import com.android.tools.lint.detector.api.Issue

/** Analyzer definition and actionable remediation shared by both JVM runners. */
internal data class RuleDefinition(
    val issue: Issue,
    val remediation: String,
)

internal val ruleDefinitions: List<RuleDefinition> = listOf(
    RuleDefinition(EmptyCatchDetector.ISSUE, EmptyCatchDetector.REMEDIATION),
    RuleDefinition(DuplicateStatementDetector.ISSUE, DuplicateStatementDetector.REMEDIATION),
    RuleDefinition(DuplicateFunctionDetector.ISSUE, DuplicateFunctionDetector.REMEDIATION),
    RuleDefinition(UnusedVariableDetector.ISSUE, UnusedVariableDetector.REMEDIATION),
    RuleDefinition(UnusedParameterDetector.ISSUE, UnusedParameterDetector.REMEDIATION),
    RuleDefinition(
        HardcodedStringComparisonDetector.ISSUE,
        HardcodedStringComparisonDetector.REMEDIATION,
    ),
    RuleDefinition(WildcardImportDetector.ISSUE, WildcardImportDetector.REMEDIATION),
    RuleDefinition(
        UnreviewableStringLiteralDetector.ISSUE,
        UnreviewableStringLiteralDetector.REMEDIATION,
    ),
    RuleDefinition(MagicNumberDetector.ISSUE, MagicNumberDetector.REMEDIATION),
)
