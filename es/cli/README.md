# agentic-gate-cli

The JavaScript and TypeScript composition root and command-line runner for Agentic Gate.

The runner loads the project's existing `eslint.config.*` and `gate.config.*`, obtains the non-negotiable policies from `agentic-gate-rules`, and injects them into `agentic-gate-engine`. The engine then controls ESLint execution, project-wide analysis, gate decisions, and result assembly.

The npm command is a minified standalone executable produced by `bun build --compile --minify`, so running the CLI does not require a separate Bun installation. The current npm release target is Linux x64 with glibc. JavaScript and declaration output remain in the package for the programmatic API.

| Component | Role |
| --- | --- |
| `agentic-gate-cli` | Loads configuration and rules, injects rules into the engine, formats results, and maps decisions to process exit statuses. |
| `agentic-gate-rules` | Supplies native policies and the curated Unicorn hard-gate preset. |
| `agentic-gate-engine` | Controls discovery, analyzers, rule invocation, decisions, and normalized `Violation` results. |
| Project ESLint configuration | Adds the project's existing plugins and rules to the same run. |

`src/runner.ts` is the composition root. It is the only application layer that needs both concrete rules and the engine; the engine never imports the rules package.

```sh
agentic-gate-cli src test
```

Runner-specific options belong in `gate.config.ts`:

```ts
import type { AgenticGateConfig } from "agentic-gate-cli";

export default {
  eslint: {
    targets: ["src", "test"]
  },
  project: {
    files: "eslint-input",
    entries: "auto"
  }
} satisfies AgenticGateConfig;
```

`eslint.config.*` remains the source of truth for the project's additional ESLint plugins and file-local rules. `gate.config.ts` describes project discovery. It cannot weaken, disable, or parameterize an Agentic Gate rule. Package manifests define project architecture; there is no configurable layer map.

`agentic-gate/no-module-dependency-cycles` requires the resolved source-module graph to remain acyclic. A violation includes the actual resolved graph as a Mermaid flowchart with cycle nodes and edges highlighted; human output prints the diagram as a fenced block and JSON output preserves it in `visualization`.

At a workspace root, the runner also treats every package declared by
`package.json#workspaces` as one architecture node. Cross-package imports must
use a declared dependency and a public package export. Relative traversal,
private package paths, and workspace dependency cycles block the gate; cycle
violations include the complete package graph. When a package script invokes a
`bin` command from a declared internal dependency, that command must be
executable from the consumer's workspace installation. If the provider was
built after installation, the resulting violation names the script and command
and tells the agent to reinstall the workspace.

Unused-code checks use Knip as an internal module-graph analyzer. `no-duplicated-statements` compares complete top-level statements, while `no-duplicated-functions` compares complete function implementations; both rules operate across every discovered file and include duplicates within one file. Duplicate-constant analysis requires reuse within the exact source directory containing the definition; parent, child, and sibling directories are separate modules.

`agentic-gate/no-extensionless-non-directory-imports` allows an extensionless relative reference only when its target is a directory module with an index interface. Concrete files use their actual source extension; ordinary directories and unresolved targets are blocked. The same directory boundary drives `agentic-gate/no-module-internal-leaks`. A named source file is a single-file interface. A directory becomes a module only when its `index.{ts,tsx,js,jsx,mjs,cjs}` fronts additional implementation files. Code outside that directory imports the module directory; it cannot name the index, address an implementation file, or pass through the module to a nested module. An index-only wrapper is rejected in favor of a sibling named source file. Library `package.json#exports` targets must point to module index files; declaration indexes such as `index.d.ts` are accepted for type conditions.

The project pass also reports the second and later occurrence of each repeated static template literal fragment containing a letter or number, including fragments in TypeScript template literal types and declaration files. Tagged templates, punctuation-only fragments, and ordinary quoted strings are outside that rule. Public check IDs remain under `agentic-gate/*`, while engine-specific details appear only as trace evidence in each violation. Rule definitions are organized in the rules package by analysis scope: [unit rules](../rules/src/rules/unit/index.ts) run through ESLint against one file, while [global rules](../rules/src/rules/global/index.ts) consume project-wide analysis.

Module interfaces list their public symbols explicitly. `agentic-gate/no-wildcard-exports` blocks `export *` and `export type *` because either form lets an implementation file expand its caller's public API without an interface change.

## Developer documentation

Run `bun run docs` at the repository root to render source comments from `agentic-gate-rules` with TypeDoc and include its standalone site in the shared Agentic Gate developer portal.

`bun run gate:self` runs the published gate policy against every JavaScript and TypeScript file in the repository, including source, tests, configuration, tooling, and built-artifact checks under `smoke/`. Generated output, dependencies, and intentional violation fixtures under `tests/fixtures` are excluded from this self-check.

## Agent integration

Use JSON output when invoking the gate from a coding agent or automation:

```sh
agentic-gate-cli --format json
```

Exit status `0` means the gate passed, `1` means violations blocked the result, and `2` means configuration or execution failed. A blocked result contains actionable violations with remediation instructions and a verification step; run the gate again after applying the repairs.
