package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Context
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import org.jetbrains.uast.UElement
import org.jetbrains.uast.ULiteralExpression
import org.jetbrains.uast.UPolyadicExpression

/** Detects a string literal on a source line outside GitHub's intra-line diff contract. */
internal class UnreviewableStringLiteralDetector : Detector(), Detector.UastScanner {
    private val reportedRanges = mutableSetOf<IntRange>()

    override fun beforeCheckFile(context: Context) {
        reportedRanges.clear()
    }

    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(ULiteralExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitLiteralExpression(node: ULiteralExpression) {
                if (!node.isString) return
                val literal = (node.uastParent as? UPolyadicExpression) ?: node
                val location = context.getLocation(literal)
                val offsets = (location.start?.offset ?: return)..(location.end?.offset ?: return)
                if (!reportedRanges.add(offsets)) return
                val firstLine = location.start?.line ?: return
                val lastLine = location.end?.line ?: firstLine
                val lines = context.file.readLines()
                val hasUnreviewableLine = (firstLine..lastLine).any { line ->
                    lines.getOrNull(line)?.length?.let { length ->
                        length >= GITHUB_INTRA_LINE_DIFF_EXCLUSIVE_LIMIT
                    } == true
                }
                if (!hasUnreviewableLine) return
                context.report(
                    ISSUE,
                    literal,
                    location,
                    "This string occupies a source line that GitHub cannot highlight at character level.",
                )
            }
        }

    companion object {
        const val ID: String = "AgenticGateUnreviewableStringLiteral"
        const val REMEDIATION: String =
            "Split the string literal so every source line is shorter than 1024 characters."
        private const val GITHUB_INTRA_LINE_DIFF_EXCLUSIVE_LIMIT: Int = 1024

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "String literal cannot receive intra-line review",
            explanation = """
                GitHub-compatible intra-line diff highlighting requires both versions of a source
                line to be shorter than 1024 UTF-16 code units. The complete source line is measured
                because that is the unit received by the review interface.
            """,
            detector = UnreviewableStringLiteralDetector::class.java,
        )
    }
}
