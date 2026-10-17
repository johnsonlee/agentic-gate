/** Enforces directory-module interfaces for source references and package exports. */

import { readFile } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve
} from "node:path";
import {
  createProjectViolation,
  type ProjectRule,
  type Violation
} from "../../contract";
import {
  cleanSourceSpecifier,
  collectSourceReferences,
  isRelativeSourceSpecifier,
  ModuleIndexBaseName,
  ModuleIndexExtensions,
  packageExportTargets,
  PathSegments,
  type ProjectContext,
  resolveSourceReference,
  sourceNodeLocation,
  type SourceReference
} from "../../project";

export const InternalLeakKinds = {
  MODULE_REFERENCE: "MODULE_REFERENCE",
  PACKAGE_EXPORT: "PACKAGE_EXPORT",
  REDUNDANT_MODULE_DIRECTORY: "REDUNDANT_MODULE_DIRECTORY"
} as const;

export interface ModuleBoundaryRules {
  extensionlessReferences: ProjectRule<any>;
  internalLeaks: ProjectRule<any>;
}

interface InvalidModuleReference extends SourceReference {
  modulePath: string;
}

interface InvalidExtensionlessReference {
  importer: string;
  reference: SourceReference;
  explicitSpecifier?: string;
}

interface ModuleBoundaryContext {
  cwd: string;
  sourceFiles: ReadonlySet<string>;
  directories: ReadonlySet<string>;
}

const moduleIndexFileNames = new Set(
  ModuleIndexExtensions.map((extension) => `${ModuleIndexBaseName}${extension}`)
);
const packageIndexFileNames = new Set([
  ...moduleIndexFileNames,
  "index.d.ts",
  "index.d.mts",
  "index.d.cts"
]);
function referencesModuleDirectory(
  importer: string,
  specifier: string,
  moduleDirectory: string
): boolean {
  return resolve(dirname(importer), cleanSourceSpecifier(specifier)) === moduleDirectory;
}

function insideDirectory(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === PathSegments.EMPTY ||
    (!path.startsWith(PathSegments.PARENT_DIRECTORY) && !isAbsolute(path));
}

function moduleDirectories(sourceFiles: ReadonlySet<string>): Set<string> {
  const directories = new Set<string>();
  for (const sourceFile of sourceFiles) {
    if (moduleIndexFileNames.has(basename(sourceFile))) {
      directories.add(dirname(sourceFile));
    }
  }
  return directories;
}

function crossedModuleDirectory(
  cwd: string,
  importer: string,
  target: string,
  directories: ReadonlySet<string>
): string | undefined {
  let directory = dirname(target);
  let crossed: string | undefined;
  while (insideDirectory(cwd, directory)) {
    if (directories.has(directory) && !insideDirectory(directory, importer)) {
      crossed = directory;
    }
    if (directory === cwd) break;
    directory = dirname(directory);
  }
  return crossed;
}

function invalidModuleReference(
  importer: string,
  reference: SourceReference,
  context: ModuleBoundaryContext
): InvalidModuleReference | undefined {
  const target = resolveSourceReference(
    importer,
    reference.specifier,
    context.sourceFiles
  );
  if (!target || dirname(target) === dirname(importer)) return undefined;
  const visibleDirectory = crossedModuleDirectory(
    context.cwd,
    importer,
    target,
    context.directories
  );
  if (!visibleDirectory) return undefined;
  if (
    dirname(target) === visibleDirectory &&
    moduleIndexFileNames.has(basename(target)) &&
    referencesModuleDirectory(importer, reference.specifier, visibleDirectory)
  ) {
    return undefined;
  }
  return {
    ...reference,
    modulePath: visibleDirectory
  };
}

function referenceViolation(
  cwd: string,
  importer: string,
  reference: InvalidModuleReference,
  rule: ProjectRule<any>
): Violation {
  return createProjectViolation(
    rule,
    {
      kind: InternalLeakKinds.MODULE_REFERENCE,
      specifier: reference.specifier,
      modulePath: relative(cwd, reference.modulePath)
    },
    {
      file: relative(cwd, importer),
      ...sourceNodeLocation(reference.node)
    },
    {
      messageId: InternalLeakKinds.MODULE_REFERENCE,
      symbol: reference.specifier
    }
  );
}

function invalidExtensionlessReference(
  importer: string,
  reference: SourceReference,
  context: ModuleBoundaryContext
): InvalidExtensionlessReference | undefined {
  const specifier = cleanSourceSpecifier(reference.specifier);
  if (!isRelativeSourceSpecifier(specifier) || extname(specifier)) return undefined;
  const base = resolve(dirname(importer), specifier);
  if (context.directories.has(base)) return undefined;
  const target = resolveSourceReference(importer, specifier, context.sourceFiles);
  const extension = target ? extname(target) : undefined;
  const explicitSpecifier = extension && `${base}${extension}` === target
    ? `${specifier}${extension}`
    : undefined;
  return { importer, reference, explicitSpecifier };
}

function extensionlessReferenceViolation(
  cwd: string,
  extensionless: InvalidExtensionlessReference,
  rule: ProjectRule<any>
): Violation {
  const { importer, reference, explicitSpecifier } = extensionless;
  return createProjectViolation(
    rule,
    {
      specifier: reference.specifier,
      explicitSpecifier
    },
    {
      file: relative(cwd, importer),
      ...sourceNodeLocation(reference.node)
    },
    { symbol: reference.specifier }
  );
}

async function packageFiles(cwd: string, sourceFiles: string[]): Promise<string[]> {
  const packages = new Set<string>();
  for (const sourceFile of sourceFiles) {
    let directory = dirname(sourceFile);
    while (insideDirectory(cwd, directory)) {
      const packageFile = join(directory, "package.json");
      if (await Bun.file(packageFile).exists()) packages.add(packageFile);
      if (directory === cwd) break;
      directory = dirname(directory);
    }
  }
  const rootPackage = join(cwd, "package.json");
  if (await Bun.file(rootPackage).exists()) packages.add(rootPackage);
  return [...packages].sort();
}

function invalidPackageExport(target: string): boolean {
  if (!target.startsWith(`${PathSegments.CURRENT_DIRECTORY}/`)) return false;
  return !packageIndexFileNames.has(basename(target));
}

async function packageExportViolations(
  cwd: string,
  sourceFiles: string[],
  rule: ProjectRule<any>
): Promise<Violation[]> {
  const violations: Violation[] = [];
  for (const packageFile of await packageFiles(cwd, sourceFiles)) {
    const packageJson = JSON.parse(await readFile(packageFile, "utf8")) as { exports?: unknown };
    for (const target of packageExportTargets(packageJson.exports).filter(invalidPackageExport)) {
      violations.push(createProjectViolation(
        rule,
        { kind: InternalLeakKinds.PACKAGE_EXPORT, target },
        { file: relative(cwd, packageFile) },
        {
          messageId: InternalLeakKinds.PACKAGE_EXPORT,
          symbol: target
        }
      ));
    }
  }
  return violations;
}

function redundantModuleDirectoryViolations(
  cwd: string,
  sourceFiles: string[],
  rule: ProjectRule<any>
): Violation[] {
  const filesByDirectory = new Map<string, string[]>();
  const moduleParents = new Set(
    [...moduleDirectories(new Set(sourceFiles))].map((directory) => dirname(directory))
  );
  for (const sourceFile of sourceFiles) {
    const directory = dirname(sourceFile);
    const files = filesByDirectory.get(directory) ?? [];
    files.push(sourceFile);
    filesByDirectory.set(directory, files);
  }

  const violations: Violation[] = [];
  for (const [directory, files] of filesByDirectory) {
    if (files.length !== 1 || !moduleIndexFileNames.has(basename(files[0]!))) continue;
    if (moduleParents.has(directory)) continue;
    const indexFile = files[0]!;
    const relativeDirectory = relative(cwd, directory) || PathSegments.CURRENT_DIRECTORY;
    const replacement = relative(
      cwd,
      join(dirname(directory), `${basename(directory)}${extname(indexFile)}`)
    );
    violations.push(createProjectViolation(
      rule,
      {
        kind: InternalLeakKinds.REDUNDANT_MODULE_DIRECTORY,
        directory: relativeDirectory,
        replacement
      },
      { file: relative(cwd, indexFile) },
      {
        messageId: InternalLeakKinds.REDUNDANT_MODULE_DIRECTORY,
        symbol: relativeDirectory
      }
    ));
  }
  return violations;
}

/** Finds source references and package exports that bypass a module index. */
export async function findModuleBoundaryViolations(
  project: ProjectContext,
  rules: ModuleBoundaryRules
): Promise<Violation[]> {
  const { cwd, files, sources } = project;
  const sourceFiles = new Set(files);
  const directories = moduleDirectories(sourceFiles);
  const context = { cwd, sourceFiles, directories };
  const violations: Violation[] = [];

  for (const { file: importer, program } of sources) {
    for (const reference of collectSourceReferences(program)) {
      const extensionless = invalidExtensionlessReference(
        importer,
        reference,
        context
      );
      if (extensionless) {
        violations.push(extensionlessReferenceViolation(
          cwd,
          extensionless,
          rules.extensionlessReferences
        ));
      }
      const invalid = invalidModuleReference(importer, reference, context);
      if (invalid) {
        violations.push(referenceViolation(cwd, importer, invalid, rules.internalLeaks));
      }
    }
  }

  return [
    ...violations,
    ...redundantModuleDirectoryViolations(cwd, files, rules.internalLeaks),
    ...await packageExportViolations(cwd, files, rules.internalLeaks)
  ];
}
