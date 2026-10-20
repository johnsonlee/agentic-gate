/**
 * Enforces one-way relationships between workspace layers.
 *
 * The root `package.json` supplies all workspace project nodes. An edge
 * `caller -> callee` exists when the caller declares the callee as a direct
 * dependency, and that edge points from an upper layer toward a lower layer.
 * The graph is a partial order, so valid direct edges may span topological
 * ranks. Same-rank imports are not rejected by rank alone; the declared edge
 * itself establishes their order.
 *
 * `dependencies`, `optionalDependencies`, and `peerDependencies` create graph
 * edges. `devDependencies` describe development and test tooling rather than
 * production layering, so they never create an architecture cycle.
 *
 * A violation exists exactly when the declared workspace dependency graph
 * contains a directed cycle. A cycle means no consistent upper-to-lower order
 * exists. Each violation includes the complete package graph as a Mermaid
 * flowchart with the cyclic nodes and edges highlighted, so the agent can see
 * the actual dependency direction it must break. This rule has no options.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface WorkspaceDependencyCycleContext {
  projects: string[];
}

/** @hidden */
export default defineProjectRule<WorkspaceDependencyCycleContext>(import.meta.url, {
  engine: "workspace-dependencies",
  message: ({ projects }) =>
    `Workspace package dependency cycle: ${projects.join(" -> ")}.`,
  instruction: () =>
    "Break the package cycle by moving the shared contract into a lower project and keeping concrete assembly in the composition root."
});
