/**
 * Reports an internal workspace package binary that is unavailable when a
 * declared consumer invokes it directly from a `package.json` script. Agentic
 * Gate runs after compilation, so the `bin` artifact must already exist and
 * the workspace installation must expose its command through an ancestor
 * `node_modules/.bin` directory. This rule has no options.
 *
 * The violation identifies the consumer manifest, provider package, and exact
 * missing command. Build the provider first, then reinstall the workspace so
 * the package manager can create the executable link.
 *
 * @module
 */

import { defineProjectRule } from "agentic-gate-engine";

interface UnavailableWorkspaceBinaryContext {
  consumer: string;
  provider: string;
  binary: string;
  script: string;
}

/** @hidden */
export default defineProjectRule<UnavailableWorkspaceBinaryContext>(import.meta.url, {
  engine: "workspace-binaries",
  message: ({ consumer, provider, binary, script }) =>
    `Package '${consumer}' invokes unavailable workspace command '${binary}' in script '${script}', provided by '${provider}'.`,
  instruction: ({ provider, binary }) =>
    `Compile package '${provider}', then reinstall the workspace and confirm '${binary}' is linked in node_modules/.bin.`
});
