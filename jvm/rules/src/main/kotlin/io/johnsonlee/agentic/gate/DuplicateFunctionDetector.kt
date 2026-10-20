package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Context
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Location
import org.jetbrains.uast.UElement
import org.jetbrains.uast.ULambdaExpression
import org.jetbrains.uast.UMethod

/** Detects complete function implementations that are structurally identical. */
internal class DuplicateFunctionDetector : Detector(), Detector.UastScanner {
    private val firstByImplementation = mutableMapOf<String, FunctionDeclaration>()

    override fun beforeCheckRootProject(context: Context) {
        firstByImplementation.clear()
    }

    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(UMethod::class.java, ULambdaExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitMethod(node: UMethod) {
                val body = node.uastBody ?: return
                if (node.sourcePsi == null) return
                val fingerprint = functionFingerprint(node, body.asRenderString())
                val current = FunctionDeclaration(
                    name = node.name,
                    location = context.getNameLocation(node),
                )
                val first = firstByImplementation.putIfAbsent(fingerprint, current) ?: return
                context.report(
                    ISSUE,
                    node,
                    current.location.withSecondary(
                        first.location,
                        "First identical implementation is '${first.name}'.",
                    ),
                    "Function '${node.name}' duplicates the complete implementation of '${first.name}'.",
                )
            }

            override fun visitLambdaExpression(node: ULambdaExpression) {
                if (node.sourcePsi == null) return
                val fingerprint = buildString {
                    append("lambda|")
                    node.valueParameters.forEach { parameter ->
                        append(parameter.name)
                        append(':')
                        append(parameter.type.canonicalText)
                        append(';')
                    }
                    append('|')
                    append(node.body.asRenderString())
                }
                val current = FunctionDeclaration("lambda", context.getLocation(node))
                val first = firstByImplementation.putIfAbsent(fingerprint, current) ?: return
                context.report(
                    ISSUE,
                    node,
                    current.location.withSecondary(
                        first.location,
                        "First identical lambda implementation is here.",
                    ),
                    "Lambda duplicates a complete earlier lambda implementation.",
                )
            }
        }

    companion object {
        const val ID: String = "AgenticGateDuplicatedFunction"
        const val REMEDIATION: String =
            "Keep one implementation and make the duplicate call it through a shared, intentionally named API."

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Function implementation is duplicated",
            explanation = """
                Two functions are duplicates when their complete UAST implementations are equal
                after excluding only the declared function name. Parameter declarations, return
                type, modifiers, and body remain part of the comparison. The first implementation
                is retained and every later occurrence is reported, within or across source files.
            """,
            detector = DuplicateFunctionDetector::class.java,
        )

        private fun functionFingerprint(method: UMethod, body: String): String = buildString {
            append(if (method.isConstructor) "constructor" else "function")
            append('|')
            append(method.javaPsi.modifierList.text.canonicalWhitespace())
            append('|')
            append(method.returnType?.canonicalText.orEmpty())
            append('|')
            method.uastParameters.forEach { parameter ->
                append(parameter.name)
                append(':')
                append(parameter.type.canonicalText)
                append(';')
            }
            append('|')
            append(body)
        }

        private fun String.canonicalWhitespace(): String = trim().replace(Regex("\\s+"), " ")
    }
}

private data class FunctionDeclaration(
    val name: String,
    val location: Location,
)
