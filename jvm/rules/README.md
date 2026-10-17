# JVM Gate Rules

`io.johnsonlee.agentic.gate:rules` contains the non-negotiable Android Lint/UAST policies injected into the JVM engine.

| Rule ID | Blocks | Actionable |
| --- | --- | --- |
| `AgenticGateSilentCatch` | An empty Java or Kotlin catch clause that provably discards an exception. | Handle the exception explicitly or rethrow it with relevant context. |

Each rule defines its detection semantics beside the implementation in KDoc. `AgenticGateRules` is the registry consumed by the Gradle composition root; the engine never imports this project.
