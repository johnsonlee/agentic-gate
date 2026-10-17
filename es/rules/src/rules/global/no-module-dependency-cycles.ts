/**
 * Reports cycles in the resolved source-module dependency graph. Static
 * imports, re-exports, dynamic imports, and TypeScript import-equals edges
 * participate. A module graph must remain acyclic so dependencies always have
 * a stable direction and can be ordered into layers. This rule has no options.
 * Each violation includes the actual resolved dependency graph as a Mermaid
 * flowchart, with the cycle's modules and edges highlighted.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface ModuleDependencyCycleContext {
  files: string[];
}

/** @hidden */
export default defineProjectRule<ModuleDependencyCycleContext>(import.meta.url, {
  engine: "module-dependencies",
  message: ({ files }) => `Source module dependency cycle: ${files.join(" -> ")}.`,
  instruction: () =>
    "Break the cycle by extracting the shared contract into a lower module or reversing the misplaced dependency."
});
