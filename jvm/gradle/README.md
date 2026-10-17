# Agentic Gate Gradle Plugin

The `io.johnsonlee.agentic.gate` Gradle plugin is the JVM composition root. It loads the built-in rules, injects them into the engine, and automatically finalizes every Java and Kotlin compilation with the `agenticGate` task.

```kotlin
plugins {
    id("io.johnsonlee.agentic.gate") version "0.1.0"
}
```

No rule behavior is configurable. A violation fails the Gradle invocation and prints its file, source position, rule ID, message, and actionable repair instruction. The task can also be invoked directly:

```sh
./gradlew agenticGate
```

Gradle TestKit fixtures verify both Java and Kotlin compilation paths, including the required ordering: compilation succeeds first, then the gate runs and blocks the build when a rule reports a violation.
