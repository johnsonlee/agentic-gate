package io.johnsonlee.agentic.gate

import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

/** Connects Kotlin JVM and Android compiler tasks without imposing a Kotlin plugin version. */
internal object KotlinCompileIntegration {
    fun wire(
        project: Project,
        gate: TaskProvider<AgenticGateTask>,
        inputs: GateInputs,
    ) {
        project.tasks.configureEach { compile ->
            if (!compile.javaClass.hasType(KOTLIN_COMPILE_TASK_TYPE)) return@configureEach
            AgenticGatePlugin.wireCompileTask(
                compile = compile,
                gate = gate,
                inputs = inputs,
                sources = compile.inputs.files.asFileTree.matching { patterns ->
                    patterns.include(JAVA_SOURCE_PATTERN, KOTLIN_SOURCE_PATTERN)
                },
                classes = compile.outputs.files,
                libraries = project.files(),
            )
        }
    }

    private fun Class<*>.hasType(typeName: String): Boolean =
        name == typeName ||
            interfaces.any { type -> type.hasType(typeName) } ||
            superclass?.hasType(typeName) == true

    private const val KOTLIN_COMPILE_TASK_TYPE: String =
        "org.jetbrains.kotlin.gradle.tasks.KotlinCompileTool"
    private const val JAVA_SOURCE_PATTERN: String = "**/*.java"
    private const val KOTLIN_SOURCE_PATTERN: String = "**/*.kt"
}
