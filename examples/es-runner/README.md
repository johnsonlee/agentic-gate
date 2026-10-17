# ES Runner Example

This example uses `agentic-gate-cli` as the primary quality-gate entry point. The runner loads `eslint.config.mjs`, applies the complete Agentic Gate ESLint preset, and performs project-level unused code analysis.

From the repository root:

```sh
bun run build
bun run example:runner
```
