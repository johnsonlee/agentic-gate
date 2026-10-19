package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UImportStatement

/** Detects an on-demand Java or Kotlin import whose imported symbols are implicit. */
internal class WildcardImportDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(UImportStatement::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitImportStatement(node: UImportStatement) {
                if (!node.isOnDemand) return
                context.report(
                    ISSUE,
                    node,
                    context.getLocation(node),
                    "Wildcard import hides the symbols introduced into this file.",
                )
            }
        }

    companion object {
        const val ID: String = "AgenticGateWildcardImport"
        const val REMEDIATION: String =
            "Replace the wildcard import with explicit imports for every referenced symbol."

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Wildcard import hides dependencies",
            explanation = """
                An on-demand import makes a file's dependencies change when the imported package
                or type gains another symbol. List every imported symbol explicitly.
            """,
            detector = WildcardImportDetector::class.java,
        )
    }
}
