package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import org.jetbrains.uast.UCatchClause
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UMethod
import org.jetbrains.uast.UParameter

/** Detects a method or catch parameter that is declared but never read. */
internal class UnusedParameterDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(
        UMethod::class.java,
        UCatchClause::class.java,
    )

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitMethod(node: UMethod) {
                val body = node.uastBody ?: return
                if (context.evaluator.isOverride(node, false)) return
                reportUnused(context, node.uastParameters, body)
            }

            override fun visitCatchClause(node: UCatchClause) {
                reportUnused(context, node.parameters, node.body)
            }
        }

    companion object {
        const val ID: String = "AgenticGateUnusedParameter"
        const val REMEDIATION: String =
            "Remove the unused parameter and update its callers, or read it in the implementation."

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Locally controlled parameter is never read",
            explanation = """
                A parameter in a concrete method or catch clause is unused when its body contains
                no reference that reads the declaration. Override and lambda parameters are
                excluded because their signatures are controlled by another declaration.
            """,
            detector = UnusedParameterDetector::class.java,
        )

        private fun reportUnused(
            context: JavaContext,
            parameters: List<UParameter>,
            body: UElement,
        ) {
            val reads = body.readSymbols()
            parameters.forEach { parameter ->
                if (parameter.sourcePsi == null) return@forEach
                val symbol = parameter.javaPsi?.symbolKey() ?: return@forEach
                if (symbol in reads) return@forEach
                context.report(
                    ISSUE,
                    context.getNameLocation(parameter),
                    "Parameter '${parameter.name}' is never read.",
                )
            }
        }
    }
}
