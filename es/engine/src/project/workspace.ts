/**
 * # Workspace layered architecture
 *
 * The root `package.json` is the only entry point for ES architecture
 * analysis. Its `workspaces` field defines the complete set of project nodes,
 * and each workspace package is one architecture layer node. The gate analyzes
 * those projects together so that package boundaries and dependency direction
 * remain visible.
 *
 * ## Layer division
 *
 * A layer is valid when it is a real workspace package with one concrete
 * responsibility and a public interface. Every production source file belongs
 * to its nearest owning `package.json`, is reachable from that package's public
 * entries, and stays hidden unless the package exposes it through `exports`.
 * A package that only forwards or re-exports another package is not a useful
 * layer.
 *
 * The gate derives layers from workspace manifests. It does not accept a
 * separately configured numeric layer list. The resulting package graph is a
 * partial order rather than a fixed chain: a caller may depend directly on any
 * lower package whose public contract it genuinely uses. Packages are peers
 * only when neither depends on the other.
 *
 * ## Relationship judgment
 *
 * A cross-package source dependency is valid only when all of these conditions
 * hold:
 *
 * - the caller declares the target as a direct dependency;
 * - the import uses the target package name rather than a relative path;
 * - the imported package subpath is public in the target's `exports`; and
 * - adding the edge keeps the workspace package graph acyclic.
 *
 * `dependencies`, `optionalDependencies`, and `peerDependencies` create
 * architecture edges. `devDependencies` still satisfies the declaration check
 * for development and test imports, but it does not order production layers and
 * cannot create an architecture cycle.
 *
 * The caller-to-callee dependency direction defines upper-to-lower layering.
 * Topological rank is an observation of the complete graph, not a configured
 * number and not a restriction that every edge must connect adjacent ranks.
 *
 * ## Static dependencies and runtime calls
 *
 * Static source dependencies and runtime calls are different graphs. The
 * repository's required static graph is `cli -> rules`, `cli -> engine`, and
 * `rules -> engine`. At runtime, the CLI creates concrete rules, injects them
 * into the engine, and the engine calls those rules through contracts. That
 * callback does not create or authorize an `engine -> rules` source dependency.
 *
 * ## Violation criteria
 *
 * Workspace analysis reports a violation for a relative import that crosses a
 * package boundary, a package script that reaches outside its project, a
 * package export that exposes source instead of a build artifact, an import of
 * an unexported workspace subpath, a workspace import without a matching direct
 * dependency, or any cycle in the declared workspace dependency graph.
 * Dependency-cycle violations include the actual graph as a Mermaid flowchart
 * and highlight the offending cycle.
 *
 * These checks prove structural boundaries and one-way dependencies. Whether a
 * package name accurately captures a business responsibility still requires
 * design review.
 *
 * @module
 */

import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { isJavaScriptString, JavaScriptValueTypes } from "./ast.ts";

const PackageFileName = "package.json";
const RootExportSpecifier = ".";
const ArchitectureDependencyGroups = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies"
] as const;
const DeclaredDependencyGroups = [
  ...ArchitectureDependencyGroups,
  "devDependencies"
] as const;

interface PackageManifest {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, unknown>;
  bin?: string | Record<string, string>;
  exports?: unknown;
}

/**
 * One architecture layer derived from a package declared by the root workspace
 * manifest.
 */
export interface WorkspaceProject {
  name: string;
  directory: string;
  manifestFile: string;
  /** Every directly declared workspace dependency, including development-only dependencies. */
  dependencies: ReadonlySet<string>;
  /** Workspace dependencies that participate in the production architecture graph. */
  architectureDependencies: ReadonlySet<string>;
  publicSpecifiers: ReadonlySet<string>;
  binaryNames: readonly string[];
  scripts: ReadonlyMap<string, string>;
  exportTargets: readonly string[];
}

/**
 * The complete architecture graph rooted at the analyzed workspace
 * `package.json`.
 */
export interface WorkspaceGraph {
  root: string;
  projects: WorkspaceProject[];
}

function workspacePatterns(manifest: PackageManifest): string[] {
  if (Array.isArray(manifest.workspaces)) return manifest.workspaces;
  if (
    manifest.workspaces &&
    typeof manifest.workspaces === JavaScriptValueTypes.OBJECT
  ) {
    return manifest.workspaces.packages ?? [];
  }
  return [];
}

function dependencyNames(
  manifest: PackageManifest,
  groups: readonly (keyof PackageManifest)[]
): Set<string> {
  const names = new Set<string>();
  for (const group of groups) {
    const dependencies = manifest[group];
    if (
      !dependencies ||
      Array.isArray(dependencies) ||
      typeof dependencies !== JavaScriptValueTypes.OBJECT
    ) {
      continue;
    }
    for (const name of Object.keys(dependencies)) names.add(name);
  }
  return names;
}

function publicSpecifiers(name: string, exports: unknown): Set<string> {
  const specifiers = new Set<string>();
  if (!exports || typeof exports !== JavaScriptValueTypes.OBJECT || Array.isArray(exports)) {
    specifiers.add(name);
    return specifiers;
  }
  const keys = Object.keys(exports as Record<string, unknown>);
  const exportKeys = keys.filter((key) => key.startsWith("."));
  if (exportKeys.length === 0) {
    specifiers.add(name);
    return specifiers;
  }
  for (const key of exportKeys) {
    specifiers.add(
      key === RootExportSpecifier ? name : `${name}${key.slice(1)}`
    );
  }
  return specifiers;
}

function packageScripts(manifest: PackageManifest): Map<string, string> {
  if (
    !manifest.scripts ||
    Array.isArray(manifest.scripts) ||
    typeof manifest.scripts !== JavaScriptValueTypes.OBJECT
  ) return new Map();
  return new Map(
    Object.entries(manifest.scripts)
      .filter((entry): entry is [string, string] => isJavaScriptString(entry[1]))
  );
}

function packageBinaryNames(manifest: PackageManifest): string[] {
  if (isJavaScriptString(manifest.bin)) {
    const packageName = manifest.name?.split("/").at(-1);
    return packageName ? [packageName] : [];
  }
  if (
    !manifest.bin ||
    Array.isArray(manifest.bin) ||
    typeof manifest.bin !== JavaScriptValueTypes.OBJECT
  ) return [];
  return Object.keys(manifest.bin).sort();
}

export function packageExportTargets(value: unknown): string[] {
  if (isJavaScriptString(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(packageExportTargets);
  if (!value || typeof value !== JavaScriptValueTypes.OBJECT) return [];
  return Object.values(value as Record<string, unknown>).flatMap(packageExportTargets);
}

async function readManifest(file: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(file, "utf8")) as PackageManifest;
}

async function workspaceManifestFiles(
  root: string,
  manifest: PackageManifest
): Promise<string[]> {
  const included = new Set<string>();
  const excluded = new Set<string>();
  for (const pattern of workspacePatterns(manifest)) {
    const isExcluded = pattern.startsWith("!");
    const workspacePattern = isExcluded ? pattern.slice(1) : pattern;
    const glob = new Bun.Glob(join(workspacePattern, PackageFileName));
    for await (const file of glob.scan({ cwd: root, absolute: true, onlyFiles: true })) {
      (isExcluded ? excluded : included).add(resolve(file));
    }
  }
  return [...included].filter((file) => !excluded.has(file)).sort();
}

function internalWorkspaceDependencies(
  dependencies: ReadonlySet<string>,
  projectNames: ReadonlySet<string>
): Set<string> {
  return new Set(
    [...dependencies].filter((dependency) => projectNames.has(dependency))
  );
}

/**
 * Loads the workspace as one architecture graph. Project nodes come from the
 * root manifest's `workspaces`; architecture edges come from production
 * dependency declarations; public import specifiers come from each target
 * package's `exports`.
 */
export async function loadWorkspaceGraph(cwd: string): Promise<WorkspaceGraph> {
  const rootManifestFile = resolve(cwd, PackageFileName);
  if (!(await Bun.file(rootManifestFile).exists())) {
    return { root: cwd, projects: [] };
  }

  const rootManifest = await readManifest(rootManifestFile);
  const manifestFiles = [
    rootManifestFile,
    ...await workspaceManifestFiles(cwd, rootManifest)
  ];
  const manifests = await Promise.all(
    manifestFiles.map(async (manifestFile) => ({
      manifestFile,
      manifest: await readManifest(manifestFile)
    }))
  );
  const projects = manifests
    .filter(({ manifest }) => manifest.name !== undefined)
    .map(({ manifestFile, manifest }) => ({
      name: manifest.name!,
      directory: dirname(manifestFile),
      manifestFile,
      dependencies: dependencyNames(manifest, DeclaredDependencyGroups),
      architectureDependencies: dependencyNames(
        manifest,
        ArchitectureDependencyGroups
      ),
      publicSpecifiers: publicSpecifiers(manifest.name!, manifest.exports),
      binaryNames: packageBinaryNames(manifest),
      scripts: packageScripts(manifest),
      exportTargets: packageExportTargets(manifest.exports)
    }));
  const projectNames = new Set(projects.map(({ name }) => name));
  return {
    root: cwd,
    projects: projects.map((project) => ({
      ...project,
      dependencies: internalWorkspaceDependencies(
        project.dependencies,
        projectNames
      ),
      architectureDependencies: internalWorkspaceDependencies(
        project.architectureDependencies,
        projectNames
      )
    }))
  };
}

/** Produces a stable path for a workspace manifest in diagnostics. */
export function workspaceManifestPath(
  graph: WorkspaceGraph,
  project: WorkspaceProject
): string {
  return relative(graph.root, project.manifestFile) || PackageFileName;
}
