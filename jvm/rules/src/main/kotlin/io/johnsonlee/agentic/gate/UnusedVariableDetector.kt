package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Context
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.intellij.psi.PsiElement
import org.jetbrains.uast.UClassInitializer
import org.jetbrains.uast.UElement
import org.jetbrains.uast.ULambdaExpression
import org.jetbrains.uast.ULocalVariable
import org.jetbrains.uast.UMethod
import org.jetbrains.uast.visitor.AbstractUastVisitor

/** Detects a Java or Kotlin local variable whose value is never read. */
internal class UnusedVariableDetector : Detector(), Detector.UastScanner {
    private val reported = mutableSetOf<PsiElement>()

    override fun beforeCheckFile(context: Context) {
        reported.clear()
    }

    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(
        UMethod::class.java,
        ULambdaExpression::class.java,
        UClassInitializer::class.java,
    )

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitMethod(node: UMethod) {
                node.uastBody?.let { body -> inspect(context, body) }
            }

            override fun visitLambdaExpression(node: ULambdaExpression) {
                inspect(context, node.body)
            }

            override fun visitInitializer(node: UClassInitializer) {
                inspect(context, node.uastBody)
            }
        }

    private fun inspect(context: JavaContext, body: UElement) {
        val declarations = mutableMapOf<PsiElement, ULocalVariable>()
        body.accept(object : AbstractUastVisitor() {
            override fun visitLocalVariable(node: ULocalVariable): Boolean {
                if (node.sourcePsi != null) {
                    node.javaPsi?.symbolKey()?.let { symbol -> declarations[symbol] = node }
                }
                return super.visitLocalVariable(node)
            }
        })
        val reads = body.readSymbols()
        declarations
            .filterKeys { symbol -> symbol !in reads && reported.add(symbol) }
            .forEach { (_, variable) ->
                context.report(
                    ISSUE,
                    context.getNameLocation(variable),
                    "Variable '${variable.name}' is never read.",
                )
            }
    }

    companion object {
        const val ID: String = "AgenticGateUnusedVariable"
        const val REMEDIATION: String =
            "Remove the unused variable; if its initializer has required effects, execute that expression without the unused binding."

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Local variable is never read",
            explanation = """
                A local declaration with no resolved read is unused code. Assignment-only
                references do not make a value used. Remove the binding and preserve only an
                initializer expression whose effects are required.
            """,
            detector = UnusedVariableDetector::class.java,
        )
    }
}
