package io.johnsonlee.agentic.gate

import java.io.File

/** Exact inputs for one JVM analysis. Rules have no configurable behavior. */
public data class GateRequest(
    public val projectDirectory: File,
    public val sourceFiles: Set<File>,
    public val classDirectories: Set<File> = emptySet(),
    public val libraries: Set<File> = emptySet(),
)
