package io.johnsonlee.agentic.gate

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.FileCollection
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.AbstractCompile

/** Gradle composition root that runs Agentic Gate after JVM compilation. */
public class AgenticGatePlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val inputs = GateInputs(
            sources = project.objects.fileCollection(),
            classes = project.objects.fileCollection(),
            libraries = project.objects.fileCollection(),
        )
        val gate = project.tasks.register(TASK_NAME, AgenticGateTask::class.java) { task ->
            task.group = TASK_GROUP
            task.description = "Runs non-negotiable Agentic Gate rules for Java and Kotlin."
            task.projectDirectory.set(project.layout.projectDirectory)
            task.sourceFiles.from(inputs.sources)
            task.classDirectories.from(inputs.classes)
            task.libraries.from(inputs.libraries)
        }

        project.tasks.withType(AbstractCompile::class.java).configureEach { compile ->
            wireCompileTask(
                compile = compile,
                gate = gate,
                inputs = inputs,
                sources = compile.source,
                classes = compile.destinationDirectory,
                libraries = compile.classpath,
            )
        }

        KOTLIN_PLUGIN_IDS.forEach { pluginId ->
            project.pluginManager.withPlugin(pluginId) {
                KotlinCompileIntegration.wire(project, gate, inputs)
            }
        }
    }

    internal companion object {
        const val TASK_NAME: String = "agenticGate"
        private const val TASK_GROUP: String = "verification"
        private val KOTLIN_PLUGIN_IDS = listOf(
            "org.jetbrains.kotlin.jvm",
            "org.jetbrains.kotlin.android",
        )

        fun wireCompileTask(
            compile: Task,
            gate: TaskProvider<AgenticGateTask>,
            inputs: GateInputs,
            sources: FileCollection,
            classes: Any,
            libraries: FileCollection,
        ) {
            compile.finalizedBy(gate)
            inputs.sources.from(sources)
            inputs.classes.from(classes)
            inputs.libraries.from(libraries)
        }
    }
}

internal data class GateInputs(
    val sources: ConfigurableFileCollection,
    val classes: ConfigurableFileCollection,
    val libraries: ConfigurableFileCollection,
)
