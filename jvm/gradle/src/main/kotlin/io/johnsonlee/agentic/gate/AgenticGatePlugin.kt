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
        val lifecycle = project.tasks.register(TASK_NAME) { task ->
            task.group = TASK_GROUP
            task.description = "Runs non-negotiable Agentic Gate rules."
        }
        var jvmConfigured = false
        var androidConfigured = false

        fun configureJvm() {
            if (jvmConfigured || androidConfigured) return
            jvmConfigured = true
            configureJvmTasks(project, lifecycle)
        }

        ANDROID_PLUGIN_IDS.forEach { pluginId ->
            project.pluginManager.withPlugin(pluginId) {
                androidConfigured = true
                wireAndroidLintTasks(project, lifecycle)
            }
        }
        project.pluginManager.withPlugin(JAVA_PLUGIN_ID) { configureJvm() }
        project.pluginManager.withPlugin(KOTLIN_JVM_PLUGIN_ID) { configureJvm() }
    }

    private fun configureJvmTasks(
        project: Project,
        lifecycle: TaskProvider<Task>,
    ) {
        val inputs = GateInputs(
            sources = project.objects.fileCollection(),
            classes = project.objects.fileCollection(),
            libraries = project.objects.fileCollection(),
        )
        val gate = project.tasks.register(JVM_TASK_NAME, AgenticGateTask::class.java) { task ->
            task.group = TASK_GROUP
            task.description = "Runs Agentic Gate against JVM compiler inputs."
            task.projectDirectory.set(project.layout.projectDirectory)
            task.sourceFiles.from(inputs.sources)
            task.classDirectories.from(inputs.classes)
            task.libraries.from(inputs.libraries)
        }
        lifecycle.configure { task -> task.dependsOn(gate) }

        project.tasks.withType(AbstractCompile::class.java).all { compile ->
            wireCompileTask(
                compile = compile,
                gate = gate,
                inputs = inputs,
                sources = compile.source,
                classes = compile.destinationDirectory,
                libraries = compile.classpath,
            )
        }
        project.pluginManager.withPlugin(KOTLIN_JVM_PLUGIN_ID) {
            wireKotlinCompileTasks(project, gate, inputs)
        }
    }

    internal companion object {
        const val TASK_NAME: String = "agenticGate"
        private const val JVM_TASK_NAME: String = "agenticGateJvm"
        internal const val TASK_GROUP: String = "verification"
        private const val JAVA_PLUGIN_ID: String = "java"
        private const val KOTLIN_JVM_PLUGIN_ID: String = "org.jetbrains.kotlin.jvm"
        private val ANDROID_PLUGIN_IDS = listOf(
            "com.android.application",
            "com.android.dynamic-feature",
            "com.android.library",
            "com.android.test",
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
