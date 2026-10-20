# Java Example

This project applies the published `io.johnsonlee.agentic.gate` Gradle plugin. Compiling Java automatically runs every JVM gate after the compiler succeeds.

From the repository root:

```sh
./gradlew publishToMavenLocal
./gradlew -p examples/java compileJava
```
