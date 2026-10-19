package io.johnsonlee.agentic.gate

import java.io.File
import java.nio.file.Files
import java.util.Properties
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
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
        assertEquals(TaskOutcome.FAILED, result.task(":agenticGateJvm")?.outcome)
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
        assertTrue(result.output.contains("AgenticGateUnusedParameter"))
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
        assertEquals(TaskOutcome.SUCCESS, result.task(":agenticGateJvm")?.outcome)
        assertTrue(result.output.contains("Agentic Gate passed"))
    }

    @Test
    fun `gate invoked directly analyzes Java sources`() {
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

        val result = runner(project).withArguments("agenticGate", "--stacktrace").buildAndFail()

        assertEquals(TaskOutcome.FAILED, result.task(":agenticGateJvm")?.outcome)
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
        assertTrue(!result.output.contains("passed 0 JVM source files"))
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
        assertEquals(TaskOutcome.FAILED, result.task(":agenticGateJvm")?.outcome)
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
        assertTrue(result.output.contains("AgenticGateUnusedParameter"))
    }

    @Test
    fun `Android compile automatically runs the variant lint gate`() {
        val project = Files.createTempDirectory("agentic-gate-gradle-android-").toFile()
        val androidSdk = sequenceOf(
            System.getenv("ANDROID_HOME"),
            System.getenv("ANDROID_SDK_ROOT"),
            File(System.getProperty("user.home"), "Library/Android/sdk").path,
        )
            .filterNotNull()
            .map(::File)
            .firstOrNull(File::isDirectory)
        Properties().apply {
            setProperty("sdk.dir", requireNotNull(androidSdk).absolutePath)
        }.let { properties ->
            project.resolve("local.properties").outputStream().use { output ->
                properties.store(output, null)
            }
        }
        project.resolve("settings.gradle.kts").writeText(
            """
            pluginManagement {
                repositories {
                    google()
                    mavenCentral()
                    gradlePluginPortal()
                }
            }
            dependencyResolutionManagement {
                repositories {
                    google()
                    mavenCentral()
                }
            }
            rootProject.name = "fixture"
            """.trimIndent(),
        )
        project.resolve("build.gradle.kts").writeText(
            """
            plugins {
                id("com.android.library")
                id("io.johnsonlee.agentic.gate")
            }
            android {
                namespace = "sample"
                compileSdk = 35
            }
            """.trimIndent(),
        )
        project.resolve("src/main/java/sample/Sample.java").apply {
            parentFile.mkdirs()
            writeText(
                """
                package sample;
                public final class Sample {
                    public void run() {
                        try { execute(); } catch (RuntimeException error) { }
                    }
                    private void consume(String unused) { execute(); }
                    private void execute() { }
                }
                """.trimIndent(),
            )
        }

        val result = androidRunner(project)
            .withGradleVersion("8.10.2")
            .withArguments("compileDebugJavaWithJavac", "--stacktrace")
            .buildAndFail()

        assertEquals(TaskOutcome.SUCCESS, result.task(":compileDebugJavaWithJavac")?.outcome)
        assertEquals(TaskOutcome.FAILED, result.task(":lintDebug")?.outcome)
        assertNull(result.task(":agenticGateDebug"))
        assertTrue(result.output.contains("AgenticGateSilentCatch"))
        assertTrue(
            project.resolve("build/reports/lint-results-debug.xml")
                .readText()
                .contains("AgenticGateUnusedParameter"),
        )
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

    private fun androidRunner(project: File): GradleRunner {
        val metadata = Properties().apply {
            AgenticGatePluginFunctionalTest::class.java.classLoader
                .getResourceAsStream("plugin-under-test-metadata.properties")
                .use { input -> load(requireNotNull(input)) }
        }
        val pluginClasspath = metadata
            .getProperty("implementation-classpath")
            .split(File.pathSeparator)
            .map(::File)
        val androidClasspath = System
            .getProperty("androidPluginClasspath")
            .split(File.pathSeparator)
            .map(::File)
        return GradleRunner.create()
            .withProjectDir(project)
            .withPluginClasspath(pluginClasspath + androidClasspath)
            .forwardOutput()
    }
}
