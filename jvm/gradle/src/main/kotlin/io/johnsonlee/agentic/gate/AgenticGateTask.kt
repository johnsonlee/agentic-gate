package io.johnsonlee.agentic.gate

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

/** Runs the injected JVM rules and fails the Gradle invocation on violations. */
public abstract class AgenticGateTask : DefaultTask() {
    @get:Internal
    public abstract val projectDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    public abstract val sourceFiles: ConfigurableFileCollection

    @get:Classpath
    public abstract val classDirectories: ConfigurableFileCollection

    @get:Classpath
    public abstract val libraries: ConfigurableFileCollection

    @TaskAction
    public fun gate() {
        val request = GateRequest(
            projectDirectory = projectDirectory.get().asFile,
            sourceFiles = sourceFiles.files,
            classDirectories = classDirectories.files,
            libraries = libraries.files,
        )
        val result = AgenticGateEngine(::AgenticGateRuleRegistry).check(request)
        if (result.passed) {
            logger.lifecycle("Agentic Gate passed ${request.sourceFiles.size} JVM source files.")
            return
        }

        result.violations.forEach { violation ->
            val start = violation.location.start
            val position = if (start == null) "" else ":${start.line}:${start.column}"
            logger.error(
                "${violation.location.file}$position [${violation.check}] ${violation.message}\n" +
                    "  Actionable: ${violation.remediation.instruction}\n" +
                    "  Verify: ${violation.remediation.verification}",
            )
        }
        throw GradleException("Agentic Gate blocked ${result.violations.size} JVM violation(s).")
    }
}
