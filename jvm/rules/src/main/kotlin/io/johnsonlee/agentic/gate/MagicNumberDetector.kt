package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.UElementHandler
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.intellij.psi.PsiModifier
import com.intellij.psi.PsiVariable
import org.jetbrains.uast.UArrayAccessExpression
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UEnumConstant
import org.jetbrains.uast.ULiteralExpression
import org.jetbrains.uast.UPrefixExpression
import org.jetbrains.uast.UVariable
import org.jetbrains.uast.UastPrefixOperator

/** Detects an unnamed runtime number other than the structural values -1, 0, and 1. */
internal class MagicNumberDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes(): List<Class<out UElement>> =
        listOf(ULiteralExpression::class.java)

    override fun createUastHandler(context: JavaContext): UElementHandler =
        object : UElementHandler() {
            override fun visitLiteralExpression(node: ULiteralExpression) {
                val number = node.value as? Number ?: return
                val signedValue = signedValue(node, number)
                if (signedValue.toDouble() in STRUCTURAL_NUMBERS) return
                if (hasNamedOrStructuralContext(node)) return
                val scope = signedExpression(node)
                context.report(
                    ISSUE,
                    scope,
                    context.getLocation(scope),
                    "Magic number ${scope.asSourceString()} obscures its meaning.",
                )
            }
        }

    companion object {
        const val ID: String = "AgenticGateMagicNumber"
        const val REMEDIATION: String =
            "Replace the numeric literal with a named constant that communicates its domain meaning."
        private val STRUCTURAL_NUMBERS = setOf(-1.0, 0.0, 1.0)

        val ISSUE: Issue = gateIssue(
            id = ID,
            briefDescription = "Unnamed numeric value obscures meaning",
            explanation = """
                Runtime numbers require a name unless syntax already names their role. Final
                declarations, enum constants, and array indices provide that role. The values -1,
                0, and 1 are structural algorithm values for absence or predecessor, the zero
                element or first position, and one-step progression; they never require a name.
            """,
            detector = MagicNumberDetector::class.java,
        )

        private fun signedExpression(node: ULiteralExpression): UElement {
            val parent = node.uastParent as? UPrefixExpression ?: return node
            return if (
                parent.operator == UastPrefixOperator.UNARY_MINUS ||
                parent.operator == UastPrefixOperator.UNARY_PLUS
            ) parent else node
        }

        private fun signedValue(node: ULiteralExpression, number: Number): Number {
            val parent = node.uastParent as? UPrefixExpression ?: return number
            return if (parent.operator == UastPrefixOperator.UNARY_MINUS) {
                -number.toDouble()
            } else {
                number
            }
        }

        private fun hasNamedOrStructuralContext(node: ULiteralExpression): Boolean {
            val signed = signedExpression(node)
            val parent = signed.uastParent
            if (parent is UArrayAccessExpression && signed in parent.indices) return true
            if (parent is UVariable && parent.uastInitializer == signed) {
                return (parent.javaPsi as? PsiVariable)
                    ?.hasModifierProperty(PsiModifier.FINAL) == true
            }
            return generateSequence(parent) { ancestor -> ancestor.uastParent }
                .takeWhile { ancestor -> ancestor !is org.jetbrains.uast.UMethod }
                .any { ancestor -> ancestor is UEnumConstant }
        }
    }
}
