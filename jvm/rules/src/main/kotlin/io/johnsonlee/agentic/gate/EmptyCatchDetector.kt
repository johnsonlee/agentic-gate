package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import org.jetbrains.uast.UBlockExpression
import org.jetbrains.uast.UCatchClause
import org.jetbrains.uast.UElement

/** Detects a catch clause whose body contains no executable expression. */
internal class EmptyCatchDetector : Detector(), Detector.UastScanner {
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

    companion object {
        const val ID: String = "AgenticGateSilentCatch"
        const val REMEDIATION: String =
            "Handle the caught exception explicitly or rethrow it with relevant context."
        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Exception is silently discarded",
            explanation = """
                An empty catch clause proves that the caught exception is discarded.
                Handle it explicitly, add relevant context and rethrow it, or propagate it.
            """,
            detector = EmptyCatchDetector::class.java,
        )
    }
}
