# Android Example

This Android library applies `io.johnsonlee.agentic.gate`. Each variant compile is followed by that variant's native Android lint task with the Agentic Gate rule artifact on `lintChecks`.

From the repository root:

```sh
./gradlew publishToMavenLocal
./gradlew -p examples/android assembleDebug
```
