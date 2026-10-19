# JVM Gate Rules

`io.johnsonlee.agentic.gate:rules` contains the non-negotiable Java and Kotlin policies injected into the JVM engine. Each rule defines its ID, detection semantics, and remediation beside the implementation in KDoc; Dokka renders those source comments into the JVM Rules site in the generated developer portal.

`AgenticGateRuleRegistry` is consumed by the Gradle composition root, while `AgenticGateIssueRegistry` is loaded by Android lint tasks. The engine never imports this project.
