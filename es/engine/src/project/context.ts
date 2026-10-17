import { projectFiles } from "./files.ts";
import {
  collectSourceReferences,
  resolveSourceReference
} from "./dependencies.ts";
import { parseProjectFile, type SourceNode } from "./parser.ts";

/** A source file parsed once and shared by every project-wide analyzer. */
interface ProjectSource {
  file: string;
  program: SourceNode;
}

function validateReferenceResolution(sources: ProjectSource[]): void {
  const sourceFiles = new Set(sources.map(({ file }) => file));
  for (const { file, program } of sources) {
    for (const { specifier } of collectSourceReferences(program)) {
      resolveSourceReference(file, specifier, sourceFiles);
    }
  }
}

/** Shared source inventory and syntax trees for one gate run. */
export interface ProjectContext {
  cwd: string;
  files: string[];
  sources: ProjectSource[];
}

/** Discovers and parses the project once for all global analyzers. */
export async function createProjectContext(
  cwd: string,
  eslintFiles: string[],
  configuredFiles?: "eslint-input" | string[]
): Promise<ProjectContext> {
  const files = await projectFiles(cwd, eslintFiles, configuredFiles);
  const sources = await Promise.all(files.map(async (file) => ({
    file,
    program: await parseProjectFile(file)
  })));
  validateReferenceResolution(sources);
  return { cwd, files, sources };
}
