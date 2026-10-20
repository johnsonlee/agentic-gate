package io.johnsonlee.agentic.gate

import com.android.tools.lint.checks.infrastructure.TestFiles.java
import com.android.tools.lint.checks.infrastructure.TestFiles.kotlin
import com.android.tools.lint.checks.infrastructure.TestLintTask.lint
import com.android.tools.lint.checks.infrastructure.TestMode
import kotlin.test.Test
import kotlin.test.assertEquals

class JvmRuleDetectorsTest {
    @Test
    fun `reports duplicate functions within and across files`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class First {
                        boolean first() { return false; }
                        boolean second() { return false; }
                    }
                    """,
                ).indented(),
                java(
                    """
                    package sample;
                    class Second {
                        boolean third() { return false; }
                        boolean different() { return true; }
                    }
                    """,
                ).indented(),
            )
            .issues(DuplicateFunctionDetector.ISSUE)
            .run()
            .expectErrorCount(2)
    }

    @Test
    fun `reports duplicate Kotlin functions and lambdas`() {
        lint()
            .allowMissingSdk()
            .files(
                kotlin(
                    """
                    package sample
                    fun first(): Boolean = false
                    fun second(): Boolean = false
                    val firstAction = { println("ready") }
                    val secondAction = { println("ready") }
                    """,
                ).indented(),
            )
            .issues(DuplicateFunctionDetector.ISSUE)
            .run()
            .expectErrorCount(2)
    }

    @Test
    fun `reports only complete duplicate declaration statements`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class First { static final int VALUE = 2; }
                    class Second { static final int VALUE = 2; }
                    class Third { static final int OTHER = 2; }
                    """,
                ).indented(),
            )
            .issues(DuplicateStatementDetector.ISSUE)
            .run()
            .expectErrorCount(1)
    }

    @Test
    fun `reports unused local variables and locally controlled parameters`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class JavaSample {
                        int run(int used, int unused) {
                            int result = used;
                            int discarded = 2;
                            int assignedOnly = 0;
                            assignedOnly = 1;
                            return result;
                        }
                    }
                    """,
                ).indented(),
                kotlin(
                    """
                    package sample
                    fun calculate(used: Int, unused: Int): Int {
                        val result = used
                        val discarded = 2
                        return result
                    }
                    """,
                ).indented(),
            )
            .issues(UnusedVariableDetector.ISSUE, UnusedParameterDetector.ISSUE)
            .testModes(TestMode.DEFAULT)
            .run()
            .expectErrorCount(5)
    }

    @Test
    fun `does not report parameters controlled by overrides or lambdas`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class Sample implements Runnable {
                        @Override public void run() { }
                        void accept() { java.util.List.of(1).forEach(value -> execute()); }
                        void execute() { }
                    }
                    """,
                ).indented(),
            )
            .issues(UnusedParameterDetector.ISSUE)
            .run()
            .expectClean()
    }

    @Test
    fun `reports hardcoded JVM string comparisons`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class Sample {
                        boolean ready(String status) {
                            if (status.equals("ready")) return true;
                            if (java.util.Objects.equals(status, "waiting")) return false;
                            switch (status) { case "stopped": return false; default: return false; }
                        }
                    }
                    """,
                ).indented(),
                kotlin(
                    """
                    package sample
                    fun ready(status: String): Boolean = status == "ready"
                    """,
                ).indented(),
            )
            .issues(HardcodedStringComparisonDetector.ISSUE)
            .testModes(TestMode.DEFAULT)
            .run()
            .expectErrorCount(4)
    }

    @Test
    fun `reports wildcard imports in Java and Kotlin`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    import java.util.*;
                    class JavaSample { List<String> values; }
                    """,
                ).indented(),
                kotlin(
                    """
                    package sample
                    import java.util.*
                    val values = ArrayList<String>()
                    """,
                ).indented(),
            )
            .issues(WildcardImportDetector.ISSUE)
            .run()
            .expectErrorCount(2)
    }

    @Test
    fun `reports runtime magic numbers and preserves structural and named numbers`() {
        lint()
            .allowMissingSdk()
            .files(
                java(
                    """
                    package sample;
                    class Sample {
                        static final int TIMEOUT = 5000;
                        int run(int[] values) {
                            use(-1, 0, 1, values[2]);
                            use(42);
                            return TIMEOUT;
                        }
                        void use(int... values) { }
                    }
                    """,
                ).indented(),
            )
            .issues(MagicNumberDetector.ISSUE)
            .run()
            .expectErrorCount(1)
    }

    @Test
    fun `reports string source lines at the review boundary`() {
        val reviewableLineLength = 1023
        val unreviewableLineLength = 1024
        fun source(className: String, lineLength: Int): String {
            val prefix = "class $className { String value = \""
            val suffix = "\"; }"
            return prefix + "x".repeat(lineLength - prefix.length - suffix.length) + suffix
        }
        lint()
            .allowMissingSdk()
            .files(
                java("src/Reviewable.java", source("Reviewable", reviewableLineLength)),
                java("src/Unreviewable.java", source("Unreviewable", unreviewableLineLength)),
            )
            .issues(UnreviewableStringLiteralDetector.ISSUE)
            .testModes(TestMode.DEFAULT)
            .run()
            .expectErrorCount(1)
    }

    @Test
    fun `registers every JVM hard gate once`() {
        val issues = AgenticGateIssueRegistry().issues
        assertEquals(issues.map { issue -> issue.id }.toSet().size, issues.size)
        assertEquals(9, issues.size)
        assertEquals(
            issues.map { issue -> issue.id },
            AgenticGateRuleRegistry().rules.map { rule -> rule.id },
        )
    }
}
