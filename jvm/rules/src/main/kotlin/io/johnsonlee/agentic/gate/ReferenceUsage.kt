package io.johnsonlee.agentic.gate

import com.intellij.psi.PsiElement
import org.jetbrains.uast.UBinaryExpression
import org.jetbrains.uast.UElement
import org.jetbrains.uast.UParenthesizedExpression
import org.jetbrains.uast.USimpleNameReferenceExpression
import org.jetbrains.uast.UastBinaryOperator
import org.jetbrains.uast.visitor.AbstractUastVisitor

/** Returns the resolved declaration only when this reference reads its value. */
internal fun USimpleNameReferenceExpression.resolvedReadSymbol(): PsiElement? {
    val expression = generateSequence(this as UElement) { current ->
        current.uastParent as? UParenthesizedExpression
    }.last()
    val assignment = expression.uastParent as? UBinaryExpression
    if (
        assignment?.operator == UastBinaryOperator.ASSIGN &&
        assignment.leftOperand == expression
    ) return null
    return resolve()?.symbolKey()
}

internal fun PsiElement.symbolKey(): PsiElement = originalElement.navigationElement

/** Resolves every read performed by this subtree. */
internal fun UElement.readSymbols(): Set<PsiElement> = buildSet {
    accept(object : AbstractUastVisitor() {
        override fun visitSimpleNameReferenceExpression(
            node: USimpleNameReferenceExpression,
        ): Boolean {
            node.resolvedReadSymbol()?.let(::add)
            return super.visitSimpleNameReferenceExpression(node)
        }
    })
}
