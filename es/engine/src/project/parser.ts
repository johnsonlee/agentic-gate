import { readFile } from "node:fs/promises";
import typescriptParser from "@typescript-eslint/parser";

export type SourceNode = { type: string; [key: string]: any };

export async function parseProjectFile(
  filePath: string
): Promise<SourceNode> {
  const source = await readFile(filePath, "utf8");
  return typescriptParser.parse(source, {
    filePath,
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: true
  }) as SourceNode;
}
