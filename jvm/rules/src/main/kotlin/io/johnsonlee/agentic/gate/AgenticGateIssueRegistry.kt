package io.johnsonlee.agentic.gate

import com.android.tools.lint.client.api.IssueRegistry
import com.android.tools.lint.client.api.Vendor
import com.android.tools.lint.detector.api.CURRENT_API
import com.android.tools.lint.detector.api.Issue

/** Issues loaded by an Android project's lint tasks. */
public class AgenticGateIssueRegistry : IssueRegistry() {
    override val issues: List<Issue> = ruleDefinitions.map(RuleDefinition::issue)

    override val api: Int = CURRENT_API

    override val minApi: Int = CURRENT_API

    override val vendor: Vendor = Vendor(
        vendorName = "Agentic Gate",
        identifier = "io.johnsonlee.agentic.gate",
        feedbackUrl = "https://github.com/johnsonlee/agentic-gate/issues",
        contact = "https://github.com/johnsonlee/agentic-gate",
    )
}
