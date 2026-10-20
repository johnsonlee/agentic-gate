# agentic-gate-engine

The JavaScript and TypeScript execution engine for Agentic Gate. It owns source
discovery, parsing, dependency resolution, ESLint and Knip execution,
project-wide analysis, execution order, gate decisions, and result assembly.

The engine accepts a `GateRuleSet` from its caller and invokes those rules
through public contracts. It never imports `agentic-gate-rules` and does not
provide a command-line interface. The top-level runner in `agentic-gate-cli`
loads concrete rules and injects them into `runGateEngine`.
