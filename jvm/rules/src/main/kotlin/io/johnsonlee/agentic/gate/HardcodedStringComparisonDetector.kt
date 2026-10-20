package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import org.jetbrains.uast.UCallExpression
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UExpression
import org.jetbrains.uast.ULiteralExpression
import org.jetbrains.uast.UParenthesizedExpression
import org.jetbrains.uast.UPolyadicExpression
import org.jetbrains.uast.USwitchClauseExpression
import org.jetbrains.uast.UastBinaryOperator

/** Detects a string literal used directly as a comparison value. */
internal class HardcodedStringComparisonDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> = listOf(
        ULiteralExpression::class.java,
        UCallExpression::class.java,
        USwitchClauseExpression::class.java,
    )

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitLiteralExpression(node: ULiteralExpression) {
                if (!node.isString) return
                val literal = enclosingStaticString(node)
                if (literal is UPolyadicExpression && literal.operands.firstOrNull() !== node) return
                val parent = literal.uastParent
                val comparison = parent as? UPolyadicExpression ?: return
                if (comparison.operator !in COMPARISON_OPERATORS) return
                report(context, literal)
            }

            override fun visitCallExpression(node: UCallExpression) {
                val method = node.resolve() ?: return
                val owner = method.containingClass?.qualifiedName
                val isStringMethod = method.name in STRING_COMPARISON_METHODS &&
                    owner == String::class.java.name
                val isObjectsEquality = method.name == OBJECTS_EQUALITY_METHOD &&
                    owner == OBJECTS_CLASS
                val isKotlinEquality = method.name == KOTLIN_EQUALITY_METHOD &&
                    owner == KOTLIN_INTRINSICS_CLASS
                if (!isStringMethod && !isObjectsEquality && !isKotlinEquality) return
                report(context, hardcodedString(node.receiver))
                node.valueArguments.forEach { argument ->
                    report(context, hardcodedString(argument))
                }
            }

            override fun visitSwitchClauseExpression(node: USwitchClauseExpression) {
                node.caseValues.forEach { value -> report(context, hardcodedString(value)) }
            }
        }

    companion object {
        const val ID: String = "AgenticGateHardcodedStringComparison"
        const val REMEDIATION: String =
            "Define a named constant for the string value and compare against that constant."
        private val COMPARISON_OPERATORS = setOf(
            UastBinaryOperator.EQUALS,
            UastBinaryOperator.NOT_EQUALS,
            UastBinaryOperator.IDENTITY_EQUALS,
            UastBinaryOperator.IDENTITY_NOT_EQUALS,
            UastBinaryOperator.LESS,
            UastBinaryOperator.LESS_OR_EQUALS,
            UastBinaryOperator.GREATER,
            UastBinaryOperator.GREATER_OR_EQUALS,
        )
        private val STRING_COMPARISON_METHODS = setOf(
            "compareTo",
            "compareToIgnoreCase",
            "contentEquals",
            "equals",
            "equalsIgnoreCase",
        )
        private const val OBJECTS_EQUALITY_METHOD: String = "equals"
        private const val OBJECTS_CLASS: String = "java.util.Objects"
        private const val KOTLIN_EQUALITY_METHOD: String = "areEqual"
        private const val KOTLIN_INTRINSICS_CLASS: String = "kotlin.jvm.internal.Intrinsics"

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Hardcoded string is compared directly",
            explanation = """
                A comparison value represents a domain concept. Declare it as a named constant so
                its meaning and every use are reviewable from one definition.
            """,
            detector = HardcodedStringComparisonDetector::class.java,
        )

        private fun hardcodedString(expression: UExpression?): UElement? {
            val unwrapped = generateSequence(expression) { current ->
                (current as? UParenthesizedExpression)?.expression
            }.lastOrNull()
            return when (unwrapped) {
                is ULiteralExpression -> unwrapped.takeIf(ULiteralExpression::isString)
                is UPolyadicExpression -> unwrapped.takeIf(::isStaticString)
                else -> null
            }
        }

        private fun enclosingStaticString(literal: ULiteralExpression): UElement {
            val parent = literal.uastParent
            return if (parent is UPolyadicExpression && isStaticString(parent)) parent else literal
        }

        private fun isStaticString(expression: UPolyadicExpression): Boolean =
            expression.operands.all { operand ->
                when (operand) {
                    is ULiteralExpression -> operand.isString
                    is UPolyadicExpression -> isStaticString(operand)
                    else -> false
                }
            }

        private fun report(context: JavaContext, literal: UElement?) {
            if (literal == null) return
            context.report(
                ISSUE,
                literal,
                context.getLocation(literal),
                "A hardcoded string is used in a comparison.",
            )
        }
    }
}
