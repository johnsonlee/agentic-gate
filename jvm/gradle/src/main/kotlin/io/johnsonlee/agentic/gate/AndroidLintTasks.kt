package io.johnsonlee.agentic.gate

import com.android.build.api.dsl.CommonExtension
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.Variant
import com.android.build.api.variant.VariantBuilder
import java.io.File
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

/** Connects each Android variant to its native blocking lint task. */
internal fun wireAndroidLintTasks(
    project: Project,
    lifecycle: TaskProvider<Task>,
) {
    val rules = rulesArtifact()
    require(rules.isFile) {
        "Agentic Gate JVM rules must be packaged as a jar: $rules"
    }
    project.dependencies.add(LINT_CHECKS_CONFIGURATION, project.files(rules))

    @Suppress("UNCHECKED_CAST")
    val components = project.extensions.getByName(ANDROID_COMPONENTS_EXTENSION) as
        AndroidComponentsExtension<CommonExtension<*, *, *, *, *, *>, VariantBuilder, Variant>
    components.finalizeDsl { android ->
        android.lint.apply {
            abortOnError = true
            warningsAsErrors = true
            checkTestSources = true
            checkGeneratedSources = false
        }
    }
    components.onVariants(components.selector().all()) { variant ->
        wireVariant(project, lifecycle, variant.name)
    }
}

private fun wireVariant(
    project: Project,
    lifecycle: TaskProvider<Task>,
    variantName: String,
) {
    val suffix = variantName.replaceFirstChar(Char::uppercaseChar)
    val lintTaskName = "lint$suffix"
    lifecycle.configure { task -> task.dependsOn(lintTaskName) }

    val compileTaskNames = setOf(
        "compile${suffix}JavaWithJavac",
        "compile${suffix}Kotlin",
    )
    project.tasks.configureEach { task ->
        if (task.name !in compileTaskNames) return@configureEach
        task.finalizedBy(lintTaskName)
    }
}

private fun rulesArtifact(): File = File(
    AgenticGateIssueRegistry::class.java.protectionDomain.codeSource.location.toURI(),
)

private const val ANDROID_COMPONENTS_EXTENSION: String = "androidComponents"
private const val LINT_CHECKS_CONFIGURATION: String = "lintChecks"
