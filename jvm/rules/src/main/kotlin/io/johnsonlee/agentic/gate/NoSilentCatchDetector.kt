package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import org.jetbrains.uast.UBlockExpression
import org.jetbrains.uast.UCatchClause
import org.jetbrains.uast.UElement

/**
 * Reports a catch clause whose body contains no executable expression.
 *
 * An empty Java or Kotlin catch body proves that the exception is discarded.
 * Non-empty bodies are outside this first rule because their handling behavior
 * requires a separate, provable semantic definition.
 */
public class NoSilentCatchDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(UCatchClause::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitCatchClause(node: UCatchClause) {
                val body = node.body as? UBlockExpression ?: return
                if (body.expressions.isNotEmpty()) return
                context.report(
                    issue = ISSUE,
                    scope = node,
                    location = context.getLocation(node),
                    message = "An empty catch clause discards the exception.",
                )
            }
        }

    public companion object {
        private const val HARD_GATE_PRIORITY: Int = 10

        /** Android Lint issue exposed through [AgenticGateRules]. */
        @JvmField
        public val ISSUE: Issue = Issue.create(
            id = "AgenticGateSilentCatch",
            briefDescription = "Exception is silently discarded",
            explanation = """
                An empty catch clause proves that the caught exception is discarded.
                Handle it explicitly, add relevant context and rethrow it, or propagate it.
            """,
            category = Category.CORRECTNESS,
            priority = HARD_GATE_PRIORITY,
            severity = Severity.ERROR,
            implementation = Implementation(
                NoSilentCatchDetector::class.java,
                Scope.JAVA_FILE_SCOPE,
            ),
        )
    }
}
