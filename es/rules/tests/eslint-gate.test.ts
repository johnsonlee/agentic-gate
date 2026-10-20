import { describe, expect, it } from "bun:test";
import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import unicorn from "eslint-plugin-unicorn";
import {
  agenticGateEslint,
  createGateConfig,
  ruleIdFromName
} from "../src";

const gate = agenticGateEslint.configs.gate;
const expectedRuleNames = [
  "no-consecutive-push-string-literals",
  "no-duplicated-imports",
  "no-escaped-newlines-in-template-literals",
  "no-hardcoded-string-comparisons",
  "no-joined-string-literals",
  "no-magic-numbers",
  "no-misnamed-constant-objects",
  "no-silent-catch",
  "no-unchanged-parameter-forwarding",
  "no-unreviewable-string-literals",
  "no-unused-code",
  "no-wildcard-exports"
] as const;

describe("gate config", () => {
  it("exposes stable rule and feedback metadata", () => {
    for (const [name, rule] of Object.entries(agenticGateEslint.rules)) {
      if (!("agenticGate" in rule)) throw new Error(`${name} is missing Agentic Gate metadata`);
      expect(rule.agenticGate.ruleId).toBe(ruleIdFromName(name));
      expect(rule.agenticGate.feedbackFormat).toBe("eslint-lint-message");
      expect(rule.agenticGate.messageIds.length).toBeGreaterThan(0);
    }
  });

  it("enables every Agentic Gate ESLint rule as a blocking check", () => {
    const rules = agenticGateEslint.configs.agenticGate.at(-1)?.rules;
    for (const name of expectedRuleNames) {
      const setting = rules?.[ruleIdFromName(name)];
      expect(Array.isArray(setting) ? setting[0] : setting).toBe("error");
    }
  });

  it("exposes the native and Unicorn layers independently", () => {
    expect(agenticGateEslint.configs.agenticGate).toHaveLength(1);
    expect(agenticGateEslint.configs.agenticGate[0]?.plugins).toHaveProperty("agentic-gate");
    expect(agenticGateEslint.configs.unicorn).toHaveLength(1);
    expect(agenticGateEslint.configs.unicorn[0]?.plugins).toHaveProperty("unicorn");
    expect(gate).toEqual([
      ...agenticGateEslint.configs.agenticGate,
      ...agenticGateEslint.configs.unicorn
    ]);
  });

  it("overlays nested first-party and third-party configs in order", () => {
    const thirdParty = [
      {
        name: "third-party/base",
        rules: { eqeqeq: "error" as const }
      },
      {
        name: "project/override",
        rules: { eqeqeq: "off" as const, curly: "error" as const }
      }
    ];
    const combined = createGateConfig(
      agenticGateEslint.configs.agenticGate,
      agenticGateEslint.configs.unicorn,
      thirdParty
    );

    expect(combined.map((config) => config.name)).toEqual([
      "agentic-gate/rules",
      "agentic-gate/unicorn-curated",
      "third-party/base",
      "project/override"
    ]);
    expect(combined.at(-1)?.rules).toEqual({
      eqeqeq: "off",
      curly: "error"
    });
  });

  it("promotes warning-only checks to blocking errors", () => {
    const [config] = createGateConfig({
      rules: {
        eqeqeq: "warn",
        curly: [1, "multi-line"],
        "no-console": "off"
      },
      linterOptions: { reportUnusedDisableDirectives: "warn" }
    });

    expect(config?.rules?.eqeqeq).toBe("error");
    expect(config?.rules?.curly).toEqual(["error", "multi-line"]);
    expect(config?.rules?.["no-console"]).toBe("off");
    expect(config?.linterOptions?.reportUnusedDisableDirectives).toBe("error");
  });
});

describe("curated integrations", () => {
  it("blocks a high-confidence bug with the curated Unicorn config", () => {
    const messages = new Linter().verify(
      "if (left || left) run();",
      gate,
      { filename: "input.js" }
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "unicorn/no-duplicate-logical-operands", severity: 2 })
      ])
    );
  });

  it("replaces project-supplied options with fixed Unicorn defaults", () => {
    const messages = new Linter().verify(
      "value instanceof Array;",
      [
        {
          plugins: { unicorn },
          rules: {
            "unicorn/no-instanceof-builtins": [
              "warn",
              { exclude: ["Array"], strategy: "strict" }
            ]
          }
        },
        ...agenticGateEslint.configs.unicorn
      ],
      { filename: "input.js" }
    );

    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "unicorn/no-instanceof-builtins",
        severity: 2
      })
    ]));
  });

  it("excludes negotiable Unicorn policy rules", () => {
    const rules = agenticGateEslint.configs.unicorn[0]?.rules;
    expect(rules?.["unicorn/no-for-each"]).toBeUndefined();
    expect(rules?.["unicorn/prefer-single-call"]).toBeUndefined();
    expect(rules?.["unicorn/no-accidental-bitwise-operator"]).toBeUndefined();
    expect(rules?.["unicorn/no-array-fill-with-reference-type"]).toBeUndefined();
    expect(rules?.["unicorn/no-async-promise-finally"]).toBeUndefined();
    expect(rules?.["unicorn/no-thenable"]).toBeUndefined();
    expect(rules?.["unicorn/no-xor-as-exponentiation"]).toBeUndefined();
  });

  it("contains no rules classified as suggestions by Unicorn", () => {
    const configuredRules = Object.keys(agenticGateEslint.configs.unicorn[0]?.rules ?? {});
    if (!unicorn.rules) throw new Error("Unicorn does not expose its rule metadata");
    for (const ruleId of configuredRules) {
      const name = ruleId.slice("unicorn/".length);
      expect(unicorn.rules[name]?.meta?.type).toBe("problem");
    }
  });
});

describe("gate enforcement", () => {
  it("blocks an empty catch in JavaScript", () => {
    const messages = new Linter().verify(
      "try { run(); } catch (error) {}",
      gate,
      { filename: "input.js" }
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "agentic-gate/no-silent-catch",
          severity: 2
        })
      ])
    );
  });

  it("runs against TypeScript when the project supplies its parser", () => {
    const messages = new Linter().verify(
      "function read(value: string): void { try { use(value); } catch {} }",
      [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: typescriptParser
          }
        },
        ...gate
      ],
      { filename: "input.ts" }
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "agentic-gate/no-silent-catch",
          severity: 2
        })
      ])
    );
  });
});
