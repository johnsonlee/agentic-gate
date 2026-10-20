import { relative } from "node:path";
import {
  createProjectViolation,
  type ProjectRule,
  type Violation
} from "../../contract";
import {
  collectSourceReferences,
  type ProjectContext,
  resolveSourceReference
} from "../../project";
import {
  compareDependencyEdges,
  Flowchart,
  violationLinkStyle
} from "./flowchart.ts";
import {
  cycleEdgeKeys,
  directedEdgeKey,
  findDirectedCycles,
  uniqueDirectedEdges
} from "./graph.ts";

interface DependencyEdge {
  source: string;
  target: string;
}

function dependencyEdges(project: ProjectContext): DependencyEdge[] {
  const sourceFiles = new Set(project.files);
  const edges: DependencyEdge[] = [];
  for (const { file: source, program } of project.sources) {
    for (const reference of collectSourceReferences(program)) {
      const target = resolveSourceReference(source, reference.specifier, sourceFiles);
      if (target) edges.push({ source, target });
    }
  }
  return edges;
}

function dependencyFlowchart(
  project: ProjectContext,
  edges: DependencyEdge[],
  cycle: string[]
): string {
  const files = [...project.files].sort();
  const nodeIds = new Map(files.map((file, index) => [file, `module${index}`]));
  const cycleNodes = new Set(cycle);
  const cycleEdges = cycleEdgeKeys(cycle);
  const uniqueEdges = uniqueDirectedEdges(edges).sort(compareDependencyEdges);
  const lines: string[] = [Flowchart.HEADER];

  for (const file of files) {
    const id = nodeIds.get(file)!;
    const label = JSON.stringify(relative(project.cwd, file));
    lines.push(`    ${id}[${label}]${cycleNodes.has(file) ? ":::cycle" : ""}`);
  }

  const highlightedEdges: number[] = [];
  uniqueEdges.forEach(({ source, target }, index) => {
    lines.push(`    ${nodeIds.get(source)} --> ${nodeIds.get(target)}`);
    if (cycleEdges.has(directedEdgeKey(source, target))) highlightedEdges.push(index);
  });
  lines.push("    classDef cycle fill:#ffebe9,stroke:#cf222e,stroke-width:2px");
  const linkStyle = violationLinkStyle(highlightedEdges);
  if (linkStyle) lines.push(linkStyle);
  return lines.join("\n");
}

/** Finds cycles without project-specific architecture configuration. */
export function findModuleDependencyCycles(
  project: ProjectContext,
  rule: ProjectRule<any>
): Violation[] {
  const edges = dependencyEdges(project);
  return findDirectedCycles(edges).map((cycle) => {
    const files = cycle.map((file) => relative(project.cwd, file));
    const location = files[0]!;
    return {
      ...createProjectViolation(
        rule,
      { files },
      { file: location },
      { symbol: files.join(" -> ") }
      ),
      visualization: {
        format: "mermaid" as const,
        kind: "flowchart" as const,
        source: dependencyFlowchart(project, edges, cycle)
      }
    };
  });
}
