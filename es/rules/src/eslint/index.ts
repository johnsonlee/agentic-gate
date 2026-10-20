import type { ESLint, Linter } from "eslint";
import { PackageIdentity } from "./package-metadata.ts";
import {
  defineRules,
  noConsecutivePushStringLiterals,
  noDuplicatedImports,
  noEscapedNewlinesInTemplateLiterals,
  noHardcodedStringComparisons,
  noJoinedStringLiterals,
  noMagicNumbers,
  noMisnamedConstantObjects,
  noSilentCatch,
  noUnchangedParameterForwarding,
  noUnreviewableStringLiterals,
  noUnusedCode,
  noWildcardExports
} from "../rules";
import { createGateConfig, curatedUnicornConfig } from "./configs";

const nativeRules = defineRules([
  noConsecutivePushStringLiterals,
  noDuplicatedImports,
  noEscapedNewlinesInTemplateLiterals,
  noHardcodedStringComparisons,
  noJoinedStringLiterals,
  noMagicNumbers,
  noMisnamedConstantObjects,
  noSilentCatch,
  noUnchangedParameterForwarding,
  noUnreviewableStringLiterals,
  noUnusedCode,
  noWildcardExports
]);

const blockingNativeRules = Object.fromEntries(
  Object.values(nativeRules).map((rule) => [rule.agenticGate.ruleId, "error"] as const)
);

type AgenticGateEslint = ESLint.Plugin & {
  configs: {
    agenticGate: Linter.Config[];
    unicorn: Linter.Config[];
    gate: Linter.Config[];
  };
  rules: typeof nativeRules;
};

/**
 * Native file-local checks bundled with the ES gate.
 *
 * | Rule | Blocks |
 * | --- | --- |
 * | `agentic-gate/no-consecutive-push-string-literals` | Two or more adjacent calls that push string literals into the same receiver |
 * | `agentic-gate/no-duplicated-imports` | Multiple static imports from the same module |
 * | `agentic-gate/no-escaped-newlines-in-template-literals` | Interior newline escapes that hide a template literal's rendered layout |
 * | `agentic-gate/no-hardcoded-string-comparisons` | String literals used directly in comparisons or switch cases |
 * | `agentic-gate/no-joined-string-literals` | Two or more static string literals joined into a statically known string |
 * | `agentic-gate/no-magic-numbers` | Unnamed numeric literals in executable expressions |
 * | `agentic-gate/no-misnamed-constant-objects` | `as const` object names and fields that do not follow constant naming |
 * | `agentic-gate/no-silent-catch` | Empty catch blocks that provably discard the exception |
 * | `agentic-gate/no-unchanged-parameter-forwarding` | Wrappers that only forward their parameters |
 * | `agentic-gate/no-unreviewable-string-literals` | String-literal source lines outside GitHub's intra-line diff highlighting contract |
 * | `agentic-gate/no-unused-code` | Unused imports, variables, parameters, catch bindings, and local declarations |
 * | `agentic-gate/no-wildcard-exports` | Open-ended re-exports that leak implementation symbols into a module interface |
 *
 * The `gate` preset enables every rule above and the curated Unicorn layer as
 * blocking errors. Project-wide unused files, exports, types, top-level
 * statements, and functions are handled by the CLI runner. Native Agentic Gate
 * rules have no options.
 */
const agenticGateEslint: AgenticGateEslint = {
  meta: {
    name: PackageIdentity.NAME,
    version: PackageIdentity.VERSION,
    namespace: "agentic-gate"
  },
  configs: {} as AgenticGateEslint["configs"],
  rules: nativeRules
};

const agenticGateRules: Linter.Config = {
  name: "agentic-gate/rules",
  plugins: {
    "agentic-gate": agenticGateEslint
  },
  linterOptions: {
    reportUnusedDisableDirectives: "error",
    reportUnusedInlineConfigs: "error"
  },
  rules: {
    ...blockingNativeRules,
    "no-unused-vars": "off",
    [noUnusedCode.agenticGate.ruleId]: "error"
  }
};

agenticGateEslint.configs.agenticGate = createGateConfig(agenticGateRules);
agenticGateEslint.configs.unicorn = createGateConfig(curatedUnicornConfig);
agenticGateEslint.configs.gate = createGateConfig(
  agenticGateEslint.configs.agenticGate,
  agenticGateEslint.configs.unicorn
);

export default agenticGateEslint;
export { createGateConfig } from "./configs";
