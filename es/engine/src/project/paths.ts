import { relative, resolve } from "node:path";

/** Resolves paths against the current process directory. */
export function resolvedPaths(filePaths: readonly string[]): string[] {
  const paths: string[] = [];
  for (const filePath of filePaths) paths.push(resolve(filePath));
  return paths;
}

/** Converts absolute paths to paths relative to the analyzed project. */
export function projectRelativePaths(cwd: string, filePaths: readonly string[]): string[] {
  const paths: string[] = [];
  for (const filePath of filePaths) paths.push(relative(cwd, filePath));
  return paths;
}
