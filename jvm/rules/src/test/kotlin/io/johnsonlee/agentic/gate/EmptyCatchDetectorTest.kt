package io.johnsonlee.agentic.gate

import com.android.tools.lint.checks.infrastructure.TestFiles.java
import com.android.tools.lint.checks.infrastructure.TestFiles.kotlin
import com.android.tools.lint.checks.infrastructure.TestLintTask.lint
import kotlin.test.Test

class EmptyCatchDetectorTest {
    @Test
    fun `reports empty Java and Kotlin catch clauses`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class JavaFailure {
                        void run() {
                            try { execute(); } catch (RuntimeException error) { }
                        }
                        void execute() { }
                    }
                    """,
                ).indented(),
                kotlin(
                    """
                    package sample
                    fun runKotlin() {
                        try { execute() } catch (error: RuntimeException) { }
                    }
                    fun execute() = Unit
                    """,
                ).indented(),
            )
            .issues(EmptyCatchDetector.ISSUE)
            .run()
            .expectErrorCount(2)
    }

    @Test
    fun `accepts explicit handling`() {
        lint()
            .allowMissingSdk()
            .files(
                kotlin(
                    """
                    package sample
                    fun runKotlin() {
                        try { execute() } catch (error: RuntimeException) { throw error }
                    }
                    fun execute() = Unit
                    """,
                ).indented(),
            )
            .issues(EmptyCatchDetector.ISSUE)
            .run()
            .expectClean()
    }
}
