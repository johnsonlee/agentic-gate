# JVM Gate Engine

`io.johnsonlee.agentic.gate:engine` executes injected Android Lint/UAST rules against Java and Kotlin sources. It owns lint execution, maps findings to the shared `Violation` contract, and attaches the rule's actionable repair instruction.

The engine has no dependency on the concrete rules project. A composition root supplies a `GateRuleRegistry`, which keeps execution and policy separate.

```kotlin
val result = AgenticGateEngine(::MyRuleRegistry).check(
    GateRequest(
        projectDirectory = projectDir,
        sourceFiles = sources,
        classDirectories = classes,
        libraries = classpath,
    ),
)
```

Every enabled issue is a hard gate. The engine disables source suppressions and baselines, promotes warnings to failures, and returns deterministic source-ordered violations.
