package io.johnsonlee.agentic.gate

/** A source position exposed to coding agents. Lines and columns are one-based. */
public data class SourcePosition(
    public val line: Int,
    public val column: Int,
)

/** The source range attached to a [Violation]. */
public data class SourceLocation(
    public val file: String,
    public val start: SourcePosition?,
    public val end: SourcePosition?,
)
