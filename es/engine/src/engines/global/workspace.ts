import { access } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
  createProjectViolation,
  type ProjectRule,
  type Violation
} from "../../contract";
import {
  loadWorkspaceGraph,
  PathSegments,
  workspaceManifestPath,
  collectSourceReferences,
  resolveSourceReference,
  sourceNodeLocation,
  type ProjectContext,
  type WorkspaceGraph,
  type WorkspaceProject
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
  type DirectedEdge,
  uniqueDirectedEdges
} from "./graph.ts";

export interface WorkspaceRules {
  binaries: ProjectRule<any>;
  boundaries: ProjectRule<any>;
  cycles: ProjectRule<any>;
  fileReferences: ProjectRule<any>;
}

export const WorkspaceBoundaryKinds = {
  PRIVATE_IMPORT: "PRIVATE_IMPORT",
  UNDECLARED_DEPENDENCY: "UNDECLARED_DEPENDENCY"
} as const;

export const CrossProjectFileReferenceKinds = {
  SCRIPT_REFERENCE: "SCRIPT_REFERENCE",
  SOURCE_EXPORT: "SOURCE_EXPORT",
  SOURCE_REFERENCE: "SOURCE_REFERENCE"
} as const;

const BinaryExtensions = ["", ".cmd", ".ps1"] as const;
const FileSystemErrorCodes = {
  FILE_NOT_FOUND: "ENOENT"
} as const;

const ParentPathSegments = ["../", "..\\"] as const;

function scriptFileReferences(script: string): string[] {
  return ParentPathSegments.some((segment) => script.includes(segment))
    ? [script]
    : [];
}

function scriptInvokesBinary(script: string, binary: string): boolean {
  return script.trim().split(/\s/u, 1)[0] === binary;
}

function escapesProject(directory: string, reference: string): boolean {
  const target = resolve(directory, reference.replaceAll("\\", "/"));
  const path = relative(directory, target);
  return path === PathSegments.PARENT_DIRECTORY ||
    path.startsWith(`${PathSegments.PARENT_DIRECTORY}/`) ||
    isAbsolute(path);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === FileSystemErrorCodes.FILE_NOT_FOUND
    ) return false;
    throw error;
  }
}

function indexWorkspaceProjects(
  graph: WorkspaceGraph
): Map<string, WorkspaceProject> {
  return new Map(graph.projects.map((project) => [project.name, project]));
}

async function workspaceBinaryAvailable(
  graph: WorkspaceGraph,
  consumer: WorkspaceProject,
  binary: string
): Promise<boolean> {
  let directory = consumer.directory;
  while (true) {
    const candidates = BinaryExtensions.map((extension) =>
      resolve(directory, "node_modules", ".bin", `${binary}${extension}`)
    );
    if ((await Promise.all(candidates.map(pathExists))).some(Boolean)) return true;
    if (directory === graph.root) return false;
    const parent = dirname(directory);
    if (parent === directory || escapesProject(graph.root, parent)) return false;
    directory = parent;
  }
}

/** Finds installed workspace binary contracts that are unavailable to consumers. */
export async function findUnavailableWorkspaceBinaries(
  cwd: string,
  rule: ProjectRule<any>
): Promise<Violation[]> {
  const graph = await loadWorkspaceGraph(cwd);
  const projectsByName = indexWorkspaceProjects(graph);
  const violations: Violation[] = [];
  for (const consumer of graph.projects) {
    for (const dependency of consumer.dependencies) {
      const provider = projectsByName.get(dependency);
      if (!provider) continue;
      for (const binary of provider.binaryNames) {
        const scripts = [...consumer.scripts]
          .filter(([, command]) => scriptInvokesBinary(command, binary))
          .map(([name]) => name);
        if (scripts.length === 0) continue;
        if (await workspaceBinaryAvailable(graph, consumer, binary)) continue;
        for (const script of scripts) {
          violations.push(createProjectViolation(
            rule,
            { consumer: consumer.name, provider: provider.name, binary, script },
            { file: workspaceManifestPath(graph, consumer) },
            { messageId: "UNAVAILABLE_BINARY", symbol: binary }
          ));
        }
      }
    }
  }
  return violations;
}

/** Finds manifest references that expose or execute files across project boundaries. */
export async function findCrossProjectFileReferences(
  project: ProjectContext,
  rule: ProjectRule<any>
): Promise<Violation[]> {
  const graph = await loadWorkspaceGraph(project.cwd);
  const sourceFiles = new Set(project.files.map((file) => resolve(file)));
  const violations: Violation[] = [];
  for (const source of project.sources) {
    const caller = owningProject(graph.projects, source.file);
    if (!caller) continue;
    for (const reference of collectSourceReferences(source.program)) {
      const targetFile = resolveSourceReference(
        source.file,
        reference.specifier,
        sourceFiles
      );
      const target = targetFile
        ? owningProject(graph.projects, targetFile)
        : undefined;
      if (!target || target.name === caller.name) continue;
      violations.push(createProjectViolation(
        rule,
        {
          kind: CrossProjectFileReferenceKinds.SOURCE_REFERENCE,
          project: caller.name,
          reference: reference.specifier,
          target: target.name
        },
        {
          file: relative(project.cwd, source.file),
          ...sourceNodeLocation(reference.node)
        },
        {
          messageId: CrossProjectFileReferenceKinds.SOURCE_REFERENCE,
          symbol: reference.specifier
        }
      ));
    }
  }
  for (const workspaceProject of graph.projects) {
    if (workspaceProject.directory === graph.root) continue;
    for (const [script, command] of workspaceProject.scripts) {
      for (const reference of scriptFileReferences(command)) {
        violations.push(createProjectViolation(
          rule,
          {
            kind: CrossProjectFileReferenceKinds.SCRIPT_REFERENCE,
            project: workspaceProject.name,
            reference,
            script
          },
          { file: workspaceManifestPath(graph, workspaceProject) },
          {
            messageId: CrossProjectFileReferenceKinds.SCRIPT_REFERENCE,
            symbol: reference
          }
        ));
      }
    }
    for (const target of workspaceProject.exportTargets) {
      if (!sourceFiles.has(resolve(workspaceProject.directory, target))) continue;
      violations.push(createProjectViolation(
        rule,
        {
          kind: CrossProjectFileReferenceKinds.SOURCE_EXPORT,
          project: workspaceProject.name,
          reference: target
        },
        { file: workspaceManifestPath(graph, workspaceProject) },
        {
          messageId: CrossProjectFileReferenceKinds.SOURCE_EXPORT,
          symbol: target
        }
      ));
    }
  }
  return violations;
}

function owningProject(
  projects: readonly WorkspaceProject[],
  file: string
): WorkspaceProject | undefined {
  return projects
    .filter((project) => file === project.directory || file.startsWith(`${project.directory}/`))
    .sort((left, right) => right.directory.length - left.directory.length)[0];
}

function referencedWorkspaceProject(
  projects: readonly WorkspaceProject[],
  specifier: string
): WorkspaceProject | undefined {
  return projects
    .filter((project) =>
      specifier === project.name || specifier.startsWith(`${project.name}/`)
    )
    .sort((left, right) => right.name.length - left.name.length)[0];
}

/** Finds source imports that bypass a workspace package contract. */
export async function findWorkspaceBoundaryViolations(
  project: ProjectContext,
  rule: ProjectRule<any>
): Promise<Violation[]> {
  const graph = await loadWorkspaceGraph(project.cwd);
  const violations: Violation[] = [];
  for (const source of project.sources) {
    const caller = owningProject(graph.projects, source.file);
    if (!caller) continue;
    for (const reference of collectSourceReferences(source.program)) {
      const target = referencedWorkspaceProject(graph.projects, reference.specifier);
      if (!target || target.name === caller.name) continue;
      const kind = !caller.dependencies.has(target.name)
        ? WorkspaceBoundaryKinds.UNDECLARED_DEPENDENCY
        : !target.publicSpecifiers.has(reference.specifier)
          ? WorkspaceBoundaryKinds.PRIVATE_IMPORT
          : undefined;
      if (!kind) continue;
      violations.push(createProjectViolation(
        rule,
        {
          kind,
          caller: caller.name,
          target: target.name,
          specifier: reference.specifier
        },
        {
          file: relative(project.cwd, source.file),
          ...sourceNodeLocation(reference.node)
        },
        { messageId: kind, symbol: reference.specifier }
      ));
    }
  }
  return violations;
}

function workspaceDependencyEdges(graph: WorkspaceGraph): DirectedEdge[] {
  return graph.projects.flatMap((project) =>
    [...project.architectureDependencies].map((dependency) => ({
      source: project.name,
      target: dependency
    }))
  );
}

function workspaceDependencyFlowchart(
  graph: WorkspaceGraph,
  edges: DirectedEdge[],
  cycle: string[]
): string {
  const projects = [...graph.projects].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const nodeIds = new Map(
    projects.map((project, index) => [project.name, `project${index}`])
  );
  const cycleNodes = new Set(cycle);
  const cycleEdges = cycleEdgeKeys(cycle);
  const uniqueEdges = uniqueDirectedEdges(edges).sort(compareDependencyEdges);
  const lines: string[] = [Flowchart.HEADER];
  for (const project of projects) {
    const id = nodeIds.get(project.name)!;
    const label = JSON.stringify(project.name);
    lines.push(`    ${id}[${label}]${cycleNodes.has(project.name) ? ":::cycle" : ""}`);
  }
  const highlightedEdges: number[] = [];
  uniqueEdges.forEach(({ source, target }, index) => {
    lines.push(`    ${nodeIds.get(source)!} --> ${nodeIds.get(target)!}`);
    if (cycleEdges.has(directedEdgeKey(source, target))) highlightedEdges.push(index);
  });
  lines.push("    classDef cycle fill:#ffebe9,stroke:#cf222e,stroke-width:2px");
  const linkStyle = violationLinkStyle(highlightedEdges);
  if (linkStyle) lines.push(linkStyle);
  return lines.join("\n");
}

function cycleLocation(
  graph: WorkspaceGraph,
  projectsByName: ReadonlyMap<string, WorkspaceProject>,
  cycle: string[]
): string {
  const project = projectsByName.get(cycle[0]!);
  return project ? workspaceManifestPath(graph, project) : "package.json";
}

/** Finds cycles in the package graph declared by the root workspace manifest. */
export async function findWorkspaceDependencyCycles(
  cwd: string,
  rules: WorkspaceRules
): Promise<Violation[]> {
  const graph = await loadWorkspaceGraph(cwd);
  const edges = workspaceDependencyEdges(graph);
  const projectsByName = indexWorkspaceProjects(graph);
  return findDirectedCycles(edges).map((cycle) => ({
    ...createProjectViolation(
      rules.cycles,
      { projects: cycle },
      { file: cycleLocation(graph, projectsByName, cycle) },
      { symbol: cycle.join(" -> ") }
    ),
    visualization: {
      format: "mermaid" as const,
      kind: "flowchart" as const,
      source: workspaceDependencyFlowchart(graph, edges, cycle)
    }
  }));
}
