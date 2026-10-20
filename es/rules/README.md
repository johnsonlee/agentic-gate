# agentic-gate-rules

The non-negotiable JavaScript and TypeScript policy set for Agentic Gate. It
contains native ESLint rules, the curated Unicorn gate, project-wide rule
definitions, and the `createGateRules` factory consumed by the top-level runner.
It depends on the public contracts from `agentic-gate-engine`; the engine
receives these policies through injection and never imports this package.

## Architecture standards

The generated developer documentation includes a **Workspace layered
architecture** module with its layer division principles, relationship criteria,
static and runtime dependency directions, and exact violation conditions. The
corresponding rule pages describe workspace boundary leaks and dependency cycles
in the same terms used by the implementation.
