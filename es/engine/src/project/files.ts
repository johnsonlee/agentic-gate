import { extname, resolve } from "node:path";
import { resolvedPaths } from "./paths.ts";

export const ModuleIndexExtensions = [
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx"
] as const;

export const SourceExtensions = [
  ...ModuleIndexExtensions,
  ".mts",
  ".cts"
] as const;

const sourceExtensions = new Set<string>(SourceExtensions);

function isSourceFile(filePath: string): boolean {
  return sourceExtensions.has(extname(filePath));
}

export async function projectFiles(
  cwd: string,
  eslintFiles: string[],
  configuredFiles?: "eslint-input" | string[]
): Promise<string[]> {
  const files = new Set(resolvedPaths(eslintFiles.filter(isSourceFile)));
  if (!Array.isArray(configuredFiles)) return [...files].sort();

  for (const pattern of configuredFiles) {
    const excluded = pattern.startsWith("!");
    const glob = new Bun.Glob(excluded ? pattern.slice(1) : pattern);
    for await (const filePath of glob.scan({ cwd, absolute: true, onlyFiles: true })) {
      const absolutePath = resolve(filePath);
      if (!isSourceFile(absolutePath)) continue;
      if (excluded) files.delete(absolutePath);
      else files.add(absolutePath);
    }
  }

  return [...files].sort();
}
