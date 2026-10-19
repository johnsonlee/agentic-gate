package io.johnsonlee.agentic.gate

import org.gradle.api.Project
import org.gradle.api.file.FileCollection
import org.gradle.api.tasks.TaskProvider

/** Connects Kotlin JVM compiler tasks without imposing a Kotlin plugin version. */
internal fun wireKotlinCompileTasks(
    project: Project,
    gate: TaskProvider<AgenticGateTask>,
    inputs: GateInputs,
) {
    project.tasks.all { compile ->
        if (!compile.javaClass.hasType(KOTLIN_COMPILE_TASK_TYPE)) return@all
        AgenticGatePlugin.wireCompileTask(
            compile = compile,
            gate = gate,
            inputs = inputs,
            sources = compile.inputs.files.asFileTree.matching { patterns ->
                patterns.include(JAVA_SOURCE_PATTERN, KOTLIN_SOURCE_PATTERN)
            },
            classes = compile.outputs.files,
            libraries = compile.kotlinLibraries(),
        )
    }
}

private fun org.gradle.api.Task.kotlinLibraries(): FileCollection {
    val accessor = javaClass.methods.singleOrNull { method ->
        method.name == KOTLIN_LIBRARIES_ACCESSOR && method.parameterCount == 0
    } ?: error("Kotlin compile task '$path' does not expose its libraries.")
    return accessor.invoke(this) as? FileCollection
        ?: error("Kotlin compile task '$path' returned unsupported libraries.")
}

private fun Class<*>.hasType(typeName: String): Boolean =
    name == typeName ||
        interfaces.any { type -> type.hasType(typeName) } ||
        superclass?.hasType(typeName) == true

private const val KOTLIN_COMPILE_TASK_TYPE: String =
    "org.jetbrains.kotlin.gradle.tasks.KotlinCompileTool"
private const val KOTLIN_LIBRARIES_ACCESSOR: String = "getLibraries"
private const val JAVA_SOURCE_PATTERN: String = "**/*.java"
private const val KOTLIN_SOURCE_PATTERN: String = "**/*.kt"
