package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Context
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Location
import org.jetbrains.uast.UClassInitializer
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UField
import org.jetbrains.uast.ULambdaExpression

/** Detects identical complete class-level or file-level declaration statements. */
internal class DuplicateStatementDetector : Detector(), Detector.UastScanner {
    private val firstByStatement = mutableMapOf<String, StatementDeclaration>()

    override fun beforeCheckRootProject(context: Context) {
        firstByStatement.clear()
    }

    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(
        UField::class.java,
        UClassInitializer::class.java,
    )

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitField(node: UField) {
                val initializer = node.uastInitializer ?: return
                if (initializer is ULambdaExpression || node.sourcePsi == null) return
                inspect(
                    context = context,
                    node = node,
                    label = node.name,
                    fingerprint = "field|${node.asRenderString()}",
                    location = context.getNameLocation(node),
                )
            }

            override fun visitInitializer(node: UClassInitializer) {
                if (node.sourcePsi == null) return
                inspect(
                    context = context,
                    node = node,
                    label = "initializer",
                    fingerprint = "initializer|${node.asRenderString()}",
                    location = context.getLocation(node as UElement),
                )
            }
        }

    private fun inspect(
        context: JavaContext,
        node: UElement,
        label: String,
        fingerprint: String,
        location: Location,
    ) {
        val current = StatementDeclaration(label, location)
        val first = firstByStatement.putIfAbsent(fingerprint, current) ?: return
        context.report(
            ISSUE,
            node,
            location.withSecondary(first.location, "First identical statement is '${first.label}'."),
            "Statement '$label' duplicates the complete statement '${first.label}'.",
        )
    }

    companion object {
        const val ID: String = "AgenticGateDuplicatedStatement"
        const val REMEDIATION: String =
            "Keep one declaration statement and expose its value or behavior through an intentionally shared API."

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Complete declaration statement is duplicated",
            explanation = """
                Class-level and file-level field declarations and initializer blocks are compared
                as complete UAST statements within and across files. Declaration identity remains
                part of the statement: the same value under different names is not a duplicate.
                Function bodies and isolated expressions are outside this rule.
            """,
            detector = DuplicateStatementDetector::class.java,
        )
    }
}

private data class StatementDeclaration(
    val label: String,
    val location: Location,
)
