package io.johnsonlee.agentic.gate

import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity

private const val HARD_GATE_PRIORITY: Int = 10

/** Creates a non-suppressible blocking issue with the shared JVM source scope. */
internal fun gateIssue(
    id: String,
    briefDescription: String,
    explanation: String,
    detector: Class<out Detector>,
): Issue = Issue.create(
    id = id,
    briefDescription = briefDescription,
    explanation = explanation,
    implementation = Implementation(detector, Scope.JAVA_FILE_SCOPE),
    category = Category.CORRECTNESS,
    priority = HARD_GATE_PRIORITY,
    severity = Severity.ERROR,
    suppressAnnotations = emptyList(),
)
