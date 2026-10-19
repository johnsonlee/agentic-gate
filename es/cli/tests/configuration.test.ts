import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGateConfig, runGate } from "../src";

const temporaryDirectories: string[] = [];

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentic-gate-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function runWorkspaceGate(cwd: string) {
  await mkdir(join(cwd, "src"), { recursive: true });
  await writeFile(join(cwd, "src", "index.ts"), "export const VALUE = 'value';\n");
  return runGate({
    cwd,
    patterns: ["src/index.ts"],
    config: {
      project: {
        files: ["src/**/*.ts"],
        entries: ["src/index.ts"]
      }
    }
  });
}

describe("gate configuration", () => {
  it("rejects ambiguous discovered config files", async () => {
    const cwd = await temporaryProject();
    await Promise.all([
      writeFile(join(cwd, "gate.config.ts"), "export default {};\n"),
      writeFile(join(cwd, "gate.config.mjs"), "export default {};\n")
    ]);

    await expect(loadGateConfig(cwd)).rejects.toThrow(
      "Multiple Agentic Gate config files found"
    );
  });

  it("rejects invalid discovery values instead of falling back", async () => {
    const cwd = await temporaryProject();
    await writeFile(
      join(cwd, "gate.config.ts"),
      "export default { project: { files: 'src/index.ts' } };\n"
    );

    await expect(loadGateConfig(cwd)).rejects.toThrow(
      "#project.files must be an array of strings"
    );
  });

  it("rejects unsupported fields", async () => {
    const cwd = await temporaryProject();
    await writeFile(
      join(cwd, "gate.config.ts"),
      "export default { project: { exclude: ['generated/**'] } };\n"
    );

    await expect(loadGateConfig(cwd)).rejects.toThrow(
      "#project contains unsupported field(s): exclude"
    );
  });
});

describe("workspace configuration", () => {
  it("rejects workspace projects without package names", async () => {
    const cwd = await temporaryProject();
    await mkdir(join(cwd, "packages", "unnamed"), { recursive: true });
    await Promise.all([
      writeFile(
        join(cwd, "package.json"),
        JSON.stringify({ name: "root", workspaces: ["packages/*"] })
      ),
      writeFile(join(cwd, "packages", "unnamed", "package.json"), "{}")
    ]);

    await expect(runWorkspaceGate(cwd)).rejects.toThrow(
      "Every workspace project must declare a package name"
    );
  });

  it("rejects duplicate workspace package names", async () => {
    const cwd = await temporaryProject();
    const first = join(cwd, "packages", "first");
    const second = join(cwd, "packages", "second");
    await Promise.all([
      mkdir(first, { recursive: true }),
      mkdir(second, { recursive: true })
    ]);
    await Promise.all([
      writeFile(
        join(cwd, "package.json"),
        JSON.stringify({ name: "root", workspaces: ["packages/*"] })
      ),
      writeFile(join(first, "package.json"), JSON.stringify({ name: "duplicate" })),
      writeFile(join(second, "package.json"), JSON.stringify({ name: "duplicate" }))
    ]);

    await expect(runWorkspaceGate(cwd)).rejects.toThrow(
      "Workspace package names must be unique: duplicate"
    );
  });
});
