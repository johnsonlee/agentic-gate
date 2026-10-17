package io.johnsonlee.agentic.gate

import com.android.tools.lint.LintCliClient
import com.android.tools.lint.LintCliFlags
import com.android.tools.lint.client.api.LintClient
import com.android.tools.lint.client.api.LintRequest
import com.android.tools.lint.detector.api.Incident
import com.android.tools.lint.detector.api.Position
import com.android.tools.lint.detector.api.Scope
import java.io.File

/** Executes injected Android Lint/UAST rules and returns agent-facing violations. */
public class AgenticGateEngine(
    private val ruleFactory: () -> GateRuleRegistry,
) {
    /** Runs every injected rule against production and test Java/Kotlin sources. */
    public fun check(request: GateRequest): GateResult {
        require(request.projectDirectory.isDirectory) {
            "Project directory does not exist: ${request.projectDirectory}"
        }

        val sources = request.sourceFiles
            .asSequence()
            .filter(File::isFile)
            .filter(::isJvmSource)
            .map(File::getCanonicalFile)
            .toSet()
        if (sources.isEmpty()) return GateResult(violations = emptyList(), files = emptyList())

        LintClient.clientName = CLIENT_NAME
        val rules = ruleFactory()
        val flags = LintCliFlags().apply {
            isSetExitCode = true
            isWarningsAsErrors = true
            isCheckTestSources = true
            isIgnoreTestSources = false
            isCheckGeneratedSources = false
            isShowEverything = true
            isQuiet = true
            allowSuppress = false
            allowBaselineSuppress = false
            exactCheckedIds = rules.issues.map { issue -> issue.id }.toSet()
            sourcesOverride = sources.mapNotNull(File::getParentFile).distinct()
            classesOverride = request.classDirectories.filter(File::exists)
            librariesOverride = request.libraries.filter(File::exists)
        }
        val client = LintCliClient(flags, CLIENT_NAME)
        val lintRequest = LintRequest(client, listOf(request.projectDirectory.canonicalFile)).apply {
            srcRoot = request.projectDirectory.canonicalFile
            setScope(Scope.JAVA_FILE_SCOPE)
        }

        client.run(rules, lintRequest)
        val files = sources
            .map { file -> file.displayPath(request.projectDirectory) }
            .sorted()
        val violations = client.definiteIncidents
            .asSequence()
            .filter { incident -> incident.issue.id in flags.exactCheckedIds }
            .filter { incident -> incident.location.file.canonicalFile in sources }
            .map { incident -> incident.toViolation(request.projectDirectory, rules) }
            .sortedWith(compareBy(
                { violation -> violation.location.file },
                { violation -> violation.location.start?.line },
                { violation -> violation.location.start?.column },
                Violation::check,
            ))
            .toList()
        return GateResult(violations = violations, files = files)
    }

    private fun Incident.toViolation(
        projectDirectory: File,
        rules: GateRuleRegistry,
    ): Violation {
        val source = location
        val file = source.file.canonicalFile
        return Violation(
            check = issue.id,
            message = message,
            location = SourceLocation(
                file = file.displayPath(projectDirectory),
                start = source.start.toSourcePosition(),
                end = source.end.toSourcePosition(),
            ),
            evidence = ViolationEvidence(
                engine = GateEngine.ANDROID_LINT,
                ruleId = issue.id,
            ),
            remediation = rules.feedbackFor(issue),
        )
    }

    private companion object {
        const val CLIENT_NAME: String = "agentic-gate"
        val JVM_SOURCE_EXTENSIONS: Set<String> = setOf("java", "kt")

        fun isJvmSource(file: File): Boolean = file.extension in JVM_SOURCE_EXTENSIONS

        fun File.displayPath(projectDirectory: File): String {
            val path = canonicalFile.toPath()
            val project = projectDirectory.canonicalFile.toPath()
            return if (path.startsWith(project)) project.relativize(path).toString() else path.toString()
        }

        fun Position?.toSourcePosition(): SourcePosition? = this?.let { position ->
            SourcePosition(line = position.line + 1, column = position.column + 1)
        }
    }
}
