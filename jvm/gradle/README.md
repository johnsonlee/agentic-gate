# Agentic Gate Gradle Plugin

The `io.johnsonlee.agentic.gate` Gradle plugin is the JVM composition root. It loads the built-in rules and automatically checks every Java and Kotlin compilation. Plain JVM projects use the standalone gate engine; Android projects use their native `lint<Variant>` tasks.

```kotlin
plugins {
    id("io.johnsonlee.agentic.gate") version "0.1.0"
}
```

No rule behavior is configurable. A violation fails the Gradle invocation and prints its file, source position, rule ID, message, and actionable repair instruction. The task can also be invoked directly:

```sh
./gradlew agenticGate
```

Gradle TestKit fixtures verify Java, Kotlin, direct task invocation, and Android compilation paths, including the required ordering: compilation succeeds first, then the gate runs and blocks the build when a rule reports a violation. Android projects load the same rule artifact through `lintChecks`; compile tasks and the aggregate `agenticGate` task connect directly to native variant lint tasks without registering duplicate variant aliases.
