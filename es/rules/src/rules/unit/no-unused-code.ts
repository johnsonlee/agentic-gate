/**
 * Applies TypeScript-aware unused-code analysis under the stable
 * `agentic-gate/no-unused-code` policy ID. The gate preset checks every import,
 * variable, parameter, catch binding, and local declaration without an
 * underscore-name exemption, in production and test code alike.
 *
 * This file-local rule cannot decide whether a file or exported symbol is used
 * elsewhere. The CLI runner handles those cases through project-wide module
 * graph analysis.
 *
 * @module
 */

import typescriptEslint from "@typescript-eslint/eslint-plugin";
import type { JSRuleDefinition } from "eslint";
import { defineRule } from "./policy.ts";

const upstreamRule = typescriptEslint.rules["no-unused-vars"];

if (!upstreamRule) {
  throw new Error("@typescript-eslint/no-unused-vars is unavailable");
}

const UNUSED_CODE_OPTIONS = [{
  vars: "all",
  args: "all",
  caughtErrors: "all",
  ignoreRestSiblings: false,
  ignoreUsingDeclarations: false
}] as const;
const OPTIONS_PROPERTY = "options";

/** @hidden */
export default defineRule(import.meta.url, {
  ...upstreamRule,
  meta: {
    ...upstreamRule.meta,
    schema: [],
    docs: {
      description:
        "Disallow unused imports, variables, parameters, and other local declarations."
    }
  },
  create(context: any) {
    const fixedContext = new Proxy({}, {
      get(target, property) {
        void target;
        if (property === OPTIONS_PROPERTY) return UNUSED_CODE_OPTIONS;
        return Reflect.get(context, property, context);
      }
    });
    return upstreamRule.create(fixedContext as never);
  }
} as unknown as JSRuleDefinition<{ RuleOptions: []; MessageIds: string }>);
