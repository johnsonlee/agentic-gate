package io.johnsonlee.agentic.gate

import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.gradle.testkit.runner.GradleRunner
import org.gradle.testkit.runner.TaskOutcome

class AgenticGatePluginFunctionalTest {
    @Test
    fun `compile automatically runs and fails the gate`() {
        val project = testProject(
            """
            public final class Sample {
                public void run() {
                    try { execute(); } catch (RuntimeException error) { }
                }
                private void execute() { }
            }
            """,
        )

        val result = runner(project).withArguments("compileJava", "--stacktrace").buildAndFail()

        assertEquals(TaskOutcome.SUCCESS, result.task(":compileJava")?.outcome)
        assertEquals(TaskOutcome.FAILED, result.task(":agenticGate")?.outcome)
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
        assertTrue(result.output.contains("Actionable:"))
        assertTrue(result.output.contains("Verify:"))
    }

    @Test
    fun `compile automatically runs and passes the gate`() {
        val project = testProject(
            """
            public final class Sample {
                public void run() {
                    try { execute(); } catch (RuntimeException error) { throw error; }
                }
                private void execute() { }
            }
            """,
        )

        val result = runner(project).withArguments("compileJava", "--stacktrace").build()

        assertEquals(TaskOutcome.SUCCESS, result.task(":compileJava")?.outcome)
        assertEquals(TaskOutcome.SUCCESS, result.task(":agenticGate")?.outcome)
        assertTrue(result.output.contains("Agentic Gate passed"))
    }

    @Test
    fun `Kotlin compile automatically runs the gate`() {
        val project = Files.createTempDirectory("agentic-gate-gradle-kotlin-").toFile()
        project.resolve("settings.gradle.kts").writeText("rootProject.name = \"fixture\"\n")
        project.resolve("build.gradle.kts").writeText(
            """
            plugins {
                kotlin("jvm") version "${KotlinVersion.CURRENT}"
                id("io.johnsonlee.agentic.gate")
            }
            repositories {
                google()
                mavenCentral()
            }
            """.trimIndent(),
        )
        project.resolve("src/main/kotlin/Sample.kt").apply {
            parentFile.mkdirs()
            writeText(
                """
                fun runSample() {
                    try { execute() } catch (error: RuntimeException) { }
                }
                fun execute() = Unit
                """.trimIndent(),
            )
        }

        val result = runner(project).withArguments("compileKotlin", "--stacktrace").buildAndFail()

        assertEquals(TaskOutcome.SUCCESS, result.task(":compileKotlin")?.outcome)
        assertEquals(TaskOutcome.FAILED, result.task(":agenticGate")?.outcome)
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
    }

    private fun testProject(source: String): File {
        val project = Files.createTempDirectory("agentic-gate-gradle-").toFile()
        project.resolve("settings.gradle.kts").writeText("rootProject.name = \"fixture\"\n")
        project.resolve("build.gradle.kts").writeText(
            """
            plugins {
                java
                id("io.johnsonlee.agentic.gate")
            }
            repositories {
                google()
                mavenCentral()
            }
            """.trimIndent(),
        )
        project.resolve("src/main/java/Sample.java").apply {
            parentFile.mkdirs()
            writeText(source.trimIndent())
        }
        return project
    }

    private fun runner(project: File): GradleRunner = GradleRunner.create()
        .withProjectDir(project)
        .withPluginClasspath()
        .forwardOutput()
}
