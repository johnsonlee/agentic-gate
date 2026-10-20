import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface DocsManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  generator: "typedoc" | "dokka";
  output: string;
}

interface GateSite {
  manifest: DocsManifest;
  source: string;
}

const JavaScriptValueTypes = {
  OBJECT: "object",
  STRING: "string"
} as const;
const DocumentationGenerators = {
  DOKKA: "dokka",
  TYPEDOC: "typedoc"
} as const;
const MANIFEST_FILE_NAME = "docs.manifest.json";
const HIDDEN_FILE_PREFIX = ".";
const EXCLUDED_DIRECTORY_NAMES = new Set(["build", "node_modules"]);
const GATE_CARDS_PLACEHOLDER = "{{GATE_CARDS}}";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assembledRoot = resolve(repositoryRoot, "docs");
const ecosystems = ["es", "jvm"];
const templateFile = resolve(import.meta.dir, "docs.template.html");
const stylesheetFile = resolve(import.meta.dir, "docs.css");

async function findManifests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const manifests: string[] = [];

  for (const entry of entries) {
    if (
      EXCLUDED_DIRECTORY_NAMES.has(entry.name) ||
      entry.name.startsWith(HIDDEN_FILE_PREFIX)
    ) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      manifests.push(...await findManifests(path));
    } else if (entry.isFile() && entry.name === MANIFEST_FILE_NAME) {
      manifests.push(path);
    }
  }

  return manifests;
}

function assertString(value: unknown, field: string, file: string): asserts value is string {
  if (
    typeof value !== JavaScriptValueTypes.STRING ||
    value.trim().length === 0
  ) {
    throw new TypeError(`${file}: '${field}' must be a non-empty string.`);
  }
}

function parseManifest(file: string, value: unknown): DocsManifest {
  if (!value || typeof value !== JavaScriptValueTypes.OBJECT) {
    throw new TypeError(`${file}: expected a JSON object.`);
  }
  const manifest = value as Partial<DocsManifest>;
  if (manifest.schemaVersion !== 1) {
    throw new TypeError(`${file}: unsupported schemaVersion '${manifest.schemaVersion}'.`);
  }
  assertString(manifest.id, "id", file);
  assertString(manifest.title, "title", file);
  assertString(manifest.description, "description", file);
  assertString(manifest.output, "output", file);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
    throw new TypeError(`${file}: 'id' must contain lowercase letters, digits, or hyphens.`);
  }
  if (
    manifest.generator !== DocumentationGenerators.TYPEDOC &&
    manifest.generator !== DocumentationGenerators.DOKKA
  ) {
    throw new TypeError(`${file}: 'generator' must be 'typedoc' or 'dokka'.`);
  }
  if (isAbsolute(manifest.output)) {
    throw new TypeError(`${file}: 'output' must be relative to the gate directory.`);
  }
  return manifest as DocsManifest;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadSites(): Promise<GateSite[]> {
  const manifestFiles = (
    await Promise.all(ecosystems.map((name) => findManifests(resolve(repositoryRoot, name))))
  ).flat().sort();
  const sites: GateSite[] = [];
  const ids = new Set<string>();

  for (const file of manifestFiles) {
    const manifest = parseManifest(file, JSON.parse(await readFile(file, "utf8")));
    if (ids.has(manifest.id)) {
      throw new Error(`Duplicate documentation gate id '${manifest.id}'.`);
    }
    ids.add(manifest.id);

    const gateRoot = dirname(file);
    const source = resolve(gateRoot, manifest.output);
    if (relative(gateRoot, source).startsWith("..")) {
      throw new Error(`${file}: 'output' must stay within the gate directory.`);
    }
    await access(resolve(source, "index.html")).catch(() => {
      throw new Error(`${file}: generated site is missing '${relative(repositoryRoot, source)}/index.html'.`);
    });
    sites.push({ manifest, source });
  }

  if (sites.length === 0) {
    throw new Error("No generated gate documentation sites were found.");
  }
  return sites;
}

async function renderIndex(sites: GateSite[]): Promise<string> {
  const cards = sites.map(({ manifest }) => `
        <article class="gate-card">
          <p class="generator">${escapeHtml(manifest.generator)}</p>
          <h2><a href="gates/${encodeURIComponent(manifest.id)}/">${escapeHtml(manifest.title)}</a></h2>
          <p>${escapeHtml(manifest.description)}</p>
        </article>`).join("");
  const template = await readFile(templateFile, "utf8");
  return template.replace(GATE_CARDS_PLACEHOLDER, cards);
}

const sites = await loadSites();
const stylesheet = await readFile(stylesheetFile, "utf8");
const index = await renderIndex(sites);
await rm(assembledRoot, { recursive: true, force: true });
await mkdir(resolve(assembledRoot, "gates"), { recursive: true });
for (const site of sites) {
  await cp(site.source, resolve(assembledRoot, "gates", site.manifest.id), { recursive: true });
}
await Promise.all([
  writeFile(resolve(assembledRoot, "index.html"), index),
  writeFile(resolve(assembledRoot, "site.css"), stylesheet)
]);

console.log(`Assembled ${sites.length} gate documentation site${sites.length === 1 ? "" : "s"} in ${relative(repositoryRoot, assembledRoot)}.`);
