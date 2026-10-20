import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const cli = import.meta.dir;
const ruleSource = /\/es\/rules\/dist\/rules\/(?:global|unit)\/no-[^/]+\.js$/u;
const cssTreeModule = /\/@eslint\/css-tree\/lib\/(?:data-patch|data|version)\.js$/u;
const oxcParserModule = /\/oxc-parser\/src-js\/(?:bindings|index|visit\/index)\.js$/u;
const oxcResolverModule = /\/oxc-resolver\/index\.js$/u;
const nativeBindingPackages = new Map([
  ["darwin-arm64", {
    parser: "@oxc-parser/binding-darwin-arm64",
    resolver: "@oxc-resolver/binding-darwin-arm64"
  }],
  ["darwin-x64", {
    parser: "@oxc-parser/binding-darwin-x64",
    resolver: "@oxc-resolver/binding-darwin-x64"
  }],
  ["linux-arm64", {
    parser: "@oxc-parser/binding-linux-arm64-gnu",
    resolver: "@oxc-resolver/binding-linux-arm64-gnu"
  }],
  ["linux-x64", {
    parser: "@oxc-parser/binding-linux-x64-gnu",
    resolver: "@oxc-resolver/binding-linux-x64-gnu"
  }],
  ["win32-arm64", {
    parser: "@oxc-parser/binding-win32-arm64-msvc",
    resolver: "@oxc-resolver/binding-win32-arm64-msvc"
  }],
  ["win32-x64", {
    parser: "@oxc-parser/binding-win32-x64-msvc",
    resolver: "@oxc-resolver/binding-win32-x64-msvc"
  }]
]);

function nativeBindings(): { parser: string; resolver: string } {
  const platform = `${process.platform}-${process.arch}`;
  const packages = nativeBindingPackages.get(platform);
  if (!packages) throw new Error(`Unsupported CLI binary target '${platform}'.`);
  const knip = dirname(Bun.resolveSync("knip", cli));
  const parser = dirname(Bun.resolveSync("oxc-parser", knip));
  const resolver = dirname(Bun.resolveSync("oxc-resolver", knip));
  return {
    parser: Bun.resolveSync(packages.parser, parser),
    resolver: Bun.resolveSync(packages.resolver, resolver)
  };
}

function nativeBindingAssignment(binding: string): string {
  return `nativeBinding = require(${JSON.stringify(binding)})`;
}

const preserveRuleFileNames = {
  name: "preserve-rule-file-names",
  setup(build: Bun.PluginBuilder): void {
    build.onLoad({ filter: ruleSource }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const moduleUrl = pathToFileURL(resolve("/agentic-gate/rules", basename(path))).href;
      return {
        contents: source.replaceAll("import.meta.url", JSON.stringify(moduleUrl)),
        loader: "js"
      };
    });
  }
} satisfies Bun.BunPlugin;

const embedOxc = {
  name: "embed-oxc",
  setup(build: Bun.PluginBuilder): void {
    const bindings = nativeBindings();
    build.onLoad({ filter: oxcParserModule }, async ({ path }) => {
      let source = await Bun.file(path).text();
      if (path.endsWith("/bindings.js")) {
        source = source.replaceAll(
          "nativeBinding = requireNative()",
          nativeBindingAssignment(bindings.parser)
        );
      } else if (path.endsWith("/visit/index.js")) {
        source = source
          .replace('import { createRequire } from "node:module";\n', "")
          .replace("      const require = createRequire(import.meta.url);\n", "");
      } else {
        source = source
          .replace('import { createRequire } from "node:module";\n', "")
          .replace("const require = createRequire(import.meta.url);\n", "");
      }
      return { contents: source, loader: "js" };
    });
    build.onLoad({ filter: oxcResolverModule }, async ({ path }) => {
      const source = await Bun.file(path).text();
      return {
        contents: source.replace(
          "nativeBinding = requireNative()",
          nativeBindingAssignment(bindings.resolver)
        ),
        loader: "js"
      };
    });
  }
} satisfies Bun.BunPlugin;

const bundleCssTreeData = {
  name: "bundle-css-tree-data",
  setup(build: Bun.PluginBuilder): void {
    build.onLoad({ filter: cssTreeModule }, async ({ path }) => {
      let source = await Bun.file(path).text();
      source = source
        .replace("import { createRequire } from 'module';\n", "")
        .replace("const require = createRequire(import.meta.url);\n", "")
        .replace(
          "const patch = require('../data/patch.json');",
          "import patch from '../data/patch.json';"
        )
        .replace(
          "const mdnAtrules = require('mdn-data/css/at-rules.json');",
          "import mdnAtrules from 'mdn-data/css/at-rules.json';"
        )
        .replace(
          "const mdnProperties = require('mdn-data/css/properties.json');",
          "import mdnProperties from 'mdn-data/css/properties.json';"
        )
        .replace(
          "const mdnSyntaxes = require('mdn-data/css/syntaxes.json');",
          "import mdnSyntaxes from 'mdn-data/css/syntaxes.json';"
        )
        .replace(
          "export const { version } = require('../package.json');",
          "import packageMetadata from '../package.json';\nexport const { version } = packageMetadata;"
        );
      return { contents: source, loader: "js" };
    });
  }
} satisfies Bun.BunPlugin;

const result = await Bun.build({
  entrypoints: [resolve(cli, "src/cli.ts")],
  compile: {
    outfile: resolve(cli, "dist/agentic-gate-cli")
  },
  minify: true,
  plugins: [preserveRuleFileNames, embedOxc, bundleCssTreeData]
});

if (!result.success) {
  throw new AggregateError(result.logs, "Could not compile agentic-gate-cli.");
}
