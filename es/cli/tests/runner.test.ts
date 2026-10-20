import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import {
  formatHuman,
  formatJson,
  runGate,
  type GateResult
} from "../src";

const fixtures = resolve(import.meta.dir, "fixtures");
const CLEAN_PROJECT_FILE_COUNT = 2;
const EXPECTED_SOURCE_DUPLICATE_COUNT = 2;
const EXPECTED_TEMPLATE_FRAGMENT_DUPLICATE_COUNT = 5;
const DUPLICATED_FUNCTIONS_RULE_ID = "agentic-gate/no-duplicated-functions";
const DUPLICATED_STATEMENTS_RULE_ID = "agentic-gate/no-duplicated-statements";
const DUPLICATED_CONSTANTS_IN_MODULE_RULE_ID =
  "agentic-gate/no-duplicated-constants-in-module";
const DUPLICATED_TEMPLATE_FRAGMENT_RULE_ID =
  "agentic-gate/no-duplicated-template-literal-fragments";
const MODULE_INTERNAL_LEAKS_RULE_ID = "agentic-gate/no-module-internal-leaks";
const EXTENSIONLESS_NON_DIRECTORY_IMPORTS_RULE_ID =
  "agentic-gate/no-extensionless-non-directory-imports";
const MODULE_DEPENDENCY_CYCLES_RULE_ID =
  "agentic-gate/no-module-dependency-cycles";
const WORKSPACE_DEPENDENCY_CYCLES_RULE_ID =
  "agentic-gate/no-workspace-dependency-cycles";
const WORKSPACE_INTERNAL_LEAKS_RULE_ID =
  "agentic-gate/no-workspace-internal-leaks";
const CROSS_PROJECT_FILE_REFERENCES_RULE_ID =
  "agentic-gate/no-cross-project-file-references";
const UNAVAILABLE_WORKSPACE_BINARIES_RULE_ID =
  "agentic-gate/no-unavailable-workspace-binaries";
const WORKSPACE_CONSUMER_SOURCE = "packages/consumer/src/index.ts";
const InternalLeakMessageIds = {
  MODULE_REFERENCE: "MODULE_REFERENCE",
  PACKAGE_EXPORT: "PACKAGE_EXPORT",
  REDUNDANT_MODULE_DIRECTORY: "REDUNDANT_MODULE_DIRECTORY"
} as const;
const LEFT_SYMBOL = "LEFT";
const RIGHT_SYMBOL = "RIGHT";

function violationsFor(result: GateResult, check: string) {
  return result.violations.filter((violation) => violation.check === check);
}

function violationMessageIds(violations: GateResult["violations"]) {
  return violations.map(({ evidence }) => evidence.messageId);
}

function violationFiles(violations: GateResult["violations"]) {
  return violations.map(({ location }) => location.file);
}

describe("ES Agentic Gate runner", () => {
  it("aggregates every ESLint plugin and project-level violation", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "violations"),
      patterns: ["src/index.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/index.ts"]
        }
      }
    });

    expect(result.decision).toBe("block");
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "agentic-gate/no-silent-catch",
          location: expect.objectContaining({
            file: "src/index.ts",
            start: expect.objectContaining({ line: 7 })
          }),
          evidence: expect.objectContaining({ engine: "eslint" })
        }),
        expect.objectContaining({
          check: "unicorn/no-duplicate-logical-operands",
          evidence: expect.objectContaining({ engine: "eslint" })
        }),
        expect.objectContaining({
          check: "fixture/project-rule",
          evidence: expect.objectContaining({ engine: "eslint" })
        }),
        expect.objectContaining({
          check: "agentic-gate/no-unused-files",
          location: expect.objectContaining({ file: "src/orphan.ts" }),
          evidence: expect.objectContaining({ engine: "knip" })
        }),
        expect.objectContaining({
          check: "agentic-gate/no-unused-exports",
          evidence: expect.objectContaining({
            engine: "knip",
            symbol: "unusedValue"
          })
        })
      ])
    );
    for (const violation of result.violations) {
      expect(violation.remediation.instruction.length).toBeGreaterThan(0);
      expect(violation.remediation.verification.length).toBeGreaterThan(0);
    }
    expect(JSON.parse(formatJson(result))).toEqual(result);
  });

  it("passes a clean multi-file project", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "clean")
    });

    expect(result.decision).toBe("pass");
    expect(result.violations).toEqual([]);
    expect(result.files).toHaveLength(CLEAN_PROJECT_FILE_COUNT);
  });

  it("keeps package exports as public entry points", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "public-api"),
      patterns: ["src"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: "auto"
        }
      }
    });

    expect(result.decision).toBe("pass");
    expect(result.violations).toEqual([]);
  });
});

describe("module dependency analysis", () => {
  it("fails instead of choosing among ambiguous source targets", async () => {
    const cwd = resolve(fixtures, "ambiguous-source");
    await expect(runGate({
      cwd,
      patterns: ["src/index.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/index.ts"]
        }
      }
    })).rejects.toThrow(
      "Source reference './target'"
    );
  });

  it("blocks cycles without accepting rule configuration", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "dependency-cycle"),
      patterns: ["src/**/*.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/application.ts"]
        }
      }
    });

    const violations = violationsFor(result, MODULE_DEPENDENCY_CYCLES_RULE_ID);
    expect(violations).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          "src/application.ts -> src/core.ts -> src/application.ts"
        ),
        location: expect.objectContaining({ file: "src/application.ts" }),
        visualization: expect.objectContaining({
          format: "mermaid",
          kind: "flowchart",
          source: expect.stringContaining(
            "module0 --> module1"
          )
        })
      })
    ]);
    expect(formatHuman(result)).toContain("```mermaid\n");
    expect(formatHuman(result)).toContain("flowchart LR");
  });
});

describe("workspace dependency cycles", () => {
  it("blocks cycles declared by the root workspace package graph", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "workspace-cycle"),
      patterns: ["packages/*/src/**/*.ts"],
      config: {
        project: {
          files: "eslint-input",
          entries: [
            "packages/application/src/index.ts",
            "packages/engine/src/index.ts"
          ]
        }
      }
    });

    const violations = violationsFor(result, WORKSPACE_DEPENDENCY_CYCLES_RULE_ID);
    expect(violations).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          "fixture-application -> fixture-engine -> fixture-application"
        ),
        location: expect.objectContaining({
          file: "packages/application/package.json"
        }),
        visualization: expect.objectContaining({
          format: "mermaid",
          kind: "flowchart",
          source: expect.stringContaining("project0 --> project1")
        })
      })
    ]);
    expect(result.decision).toBe("block");
  });

  it("does not let development dependencies authorize production imports", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "workspace-dev-cycle"),
      patterns: ["packages/*/src/**/*.ts"],
      config: {
        project: {
          files: "eslint-input",
          entries: [
            "packages/application/src/index.ts",
            "packages/engine/src/index.ts"
          ]
        }
      }
    });

    expect(violationsFor(result, WORKSPACE_DEPENDENCY_CYCLES_RULE_ID)).toEqual([]);
    expect(violationsFor(result, WORKSPACE_INTERNAL_LEAKS_RULE_ID)).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({
          file: "packages/engine/src/index.ts"
        }),
        evidence: expect.objectContaining({
          messageId: "UNDECLARED_DEPENDENCY",
          symbol: "fixture-dev-application"
        })
      })
    ]);
    expect(result.decision).toBe("block");
  });

});

describe("workspace boundaries", () => {
  it("reports a declared workspace command that was not linked after build", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "workspace-bin"),
      patterns: ["packages/*/src/**/*.ts"],
      config: {
        project: {
          files: "eslint-input",
          entries: [
            "packages/consumer/src/consumer.ts",
            "packages/provider/src/provider.ts"
          ]
        }
      }
    });

    expect(violationsFor(result, UNAVAILABLE_WORKSPACE_BINARIES_RULE_ID)).toEqual([
      expect.objectContaining({
        message:
          "Package 'fixture-bin-consumer' invokes unavailable workspace command 'fixture-command' in script 'check', provided by 'fixture-bin-provider'.",
        location: { file: "packages/consumer/package.json" },
        evidence: expect.objectContaining({
          engine: "workspace-binaries",
          messageId: "UNAVAILABLE_BINARY",
          symbol: "fixture-command"
        }),
        remediation: expect.objectContaining({
          instruction:
            "Compile package 'fixture-bin-provider', then reinstall the workspace and confirm 'fixture-command' is linked in node_modules/.bin."
        })
      })
    ]);
  });

  it("enforces package names, declared dependencies, and public exports", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "workspace-boundaries"),
      patterns: ["packages/*/src/**/*.ts"],
      config: {
        project: {
          files: "eslint-input",
          entries: [
            "packages/consumer/src/index.ts",
            "packages/target/src/index.ts",
            "packages/other/src/index.ts"
          ]
        }
      }
    });

    const violations = violationsFor(result, WORKSPACE_INTERNAL_LEAKS_RULE_ID);
    expect(violationMessageIds(violations)).toEqual([
      "PRIVATE_IMPORT",
      "UNDECLARED_DEPENDENCY"
    ]);
    expect(violations.every(({ location }) =>
      location.file === WORKSPACE_CONSUMER_SOURCE
    )).toBe(true);
    const fileReferences = violationsFor(
      result,
      CROSS_PROJECT_FILE_REFERENCES_RULE_ID
    );
    expect(violationMessageIds(fileReferences)).toEqual([
      "SCRIPT_REFERENCE",
      "SOURCE_REFERENCE",
      "SOURCE_REFERENCE",
      "SOURCE_EXPORT"
    ]);
    expect(violationFiles(fileReferences)).toEqual([
      "packages/consumer/package.json",
      WORKSPACE_CONSUMER_SOURCE,
      WORKSPACE_CONSUMER_SOURCE,
      "packages/target/package.json"
    ]);
    expect(fileReferences.map(({ evidence }) => evidence.symbol)).toContain(
      "../../target/dist/index.js"
    );
    expect(result.decision).toBe("block");
  });
});

describe("source-duplicate project analysis", () => {
  it("detects duplicate top-level statements within or across files", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "duplicate-statements"),
      patterns: ["src/a.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/a.ts"]
        }
      }
    });

    const duplicates = violationsFor(result, DUPLICATED_STATEMENTS_RULE_ID);
    expect(duplicates).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("Top-level statement 'ExpressionStatement'"),
        location: expect.objectContaining({
          file: "src/a.ts",
          start: expect.objectContaining({ line: 5 })
        }),
        evidence: expect.objectContaining({
          engine: "source-duplicates",
          symbol: "ExpressionStatement"
        })
      }),
      expect.objectContaining({
        message: expect.stringContaining("Top-level statement 'A' repeats statement 'A'"),
        location: expect.objectContaining({ file: "src/b.ts" }),
        evidence: expect.objectContaining({ engine: "source-duplicates", symbol: "A" })
      })
    ]);
    expect(duplicates.some((violation) => violation.evidence.symbol === LEFT_SYMBOL)).toBe(false);
    expect(duplicates.some((violation) => violation.evidence.symbol === RIGHT_SYMBOL)).toBe(false);
    expect(duplicates).toHaveLength(EXPECTED_SOURCE_DUPLICATE_COUNT);
    expect(result.decision).toBe("block");
  });

  it("detects duplicate functions within or across files", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "duplicate-functions"),
      patterns: ["src/a.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/a.ts"]
        }
      }
    });

    const duplicates = violationsFor(result, DUPLICATED_FUNCTIONS_RULE_ID);
    expect(duplicates).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("Function 'second' has the same implementation as 'first'"),
        location: expect.objectContaining({
          file: "src/a.ts",
          start: expect.objectContaining({ line: 5 })
        }),
        evidence: expect.objectContaining({ engine: "source-duplicates", symbol: "second" })
      }),
      expect.objectContaining({
        message: expect.stringContaining("Function 'third' has the same implementation as 'first'"),
        location: expect.objectContaining({ file: "src/b.ts" }),
        evidence: expect.objectContaining({ engine: "source-duplicates", symbol: "third" })
      })
    ]);
    expect(duplicates).toHaveLength(EXPECTED_SOURCE_DUPLICATE_COUNT);
    expect(result.decision).toBe("block");
  });
});

describe("template-literal project analysis", () => {
  it("detects repeated template literal fragments within and across files", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "duplicate-template-literals"),
      patterns: ["src/a.ts"],
      config: {
        project: {
          files: ["src/**/*.ts"],
          entries: ["src/a.ts"]
        }
      }
    });

    const duplicates = violationsFor(result, DUPLICATED_TEMPLATE_FRAGMENT_RULE_ID);
    expect(duplicates).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("first occurrence in src/a.ts:1"),
        location: expect.objectContaining({
          file: "src/a.ts",
          start: expect.objectContaining({ line: 6 })
        }),
        evidence: expect.objectContaining({
          engine: "source-duplicates"
        })
      }),
      expect.objectContaining({
        message: expect.stringContaining("first occurrence in src/a.ts:1"),
        location: expect.objectContaining({
          file: "src/b.ts",
          start: expect.objectContaining({ line: 3 })
        })
      }),
      expect.objectContaining({
        message: expect.stringContaining("first occurrence in src/a.ts:9"),
        location: expect.objectContaining({
          file: "src/b.ts",
          start: expect.objectContaining({ line: 5 })
        }),
        evidence: expect.objectContaining({ engine: "source-duplicates" })
      }),
      expect.objectContaining({
        message: expect.stringContaining("first occurrence in src/a.ts:13"),
        location: expect.objectContaining({
          file: "src/b.ts",
          start: expect.objectContaining({ line: 8 })
        })
      }),
      expect.objectContaining({
        message: expect.stringContaining("first occurrence in src/a.ts:1"),
        location: expect.objectContaining({
          file: "src/c.d.ts",
          start: expect.objectContaining({ line: 1 })
        }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("typeof type")
        })
      })
    ]);
    expect(duplicates).toHaveLength(EXPECTED_TEMPLATE_FRAGMENT_DUPLICATE_COUNT);
    expect(result.decision).toBe("block");
  });
});

describe("module constant project analysis", () => {
  it("shares constants within one directory and isolates every other directory", async () => {
    const result = await runGate({
      cwd: resolve(fixtures, "duplicate-constants-in-module"),
      patterns: ["src/catalog.ts"],
      config: {
        project: {
          files: ["src/**/*.{ts,js,mjs}"],
          entries: ["src/catalog.ts"]
        }
      }
    });

    const duplicates = violationsFor(result, DUPLICATED_CONSTANTS_IN_MODULE_RULE_ID);
    expect(duplicates).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          "Constant 'SHARED_STATE' repeats the same binding and exact primitive value"
        ),
        location: expect.objectContaining({ file: "src/repeated.ts" }),
        evidence: expect.objectContaining({
          engine: "source-duplicates",
          symbol: "SHARED_STATE"
        })
      })
    ]);
  });
});

async function analyzeModuleBoundaryFixture() {
  const cwd = resolve(fixtures, "module-boundaries");
  return runGate({
    cwd,
    patterns: ["src/index.ts"],
    config: {
      project: {
        files: ["src/**/*.{ts,tsx,jsx}"],
        entries: ["src/index.ts"]
      }
    }
  });
}

describe("source reference clarity", () => {
  it("distinguishes concrete files from directory module interfaces", async () => {
    const result = await analyzeModuleBoundaryFixture();
    expect(violationsFor(
      result,
      EXTENSIONLESS_NON_DIRECTORY_IMPORTS_RULE_ID
    )).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ file: "src/index.ts" }),
        evidence: expect.objectContaining({ symbol: "./no-index/value" }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("./no-index/value.ts")
        })
      }),
      expect.objectContaining({
        location: expect.objectContaining({ file: "src/index.ts" }),
        evidence: expect.objectContaining({ symbol: "./missing" }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("directory module")
        })
      })
    ]);
  });
});

describe("module boundary project analysis", () => {
  it("protects directory module interfaces and package exports", async () => {
    const result = await analyzeModuleBoundaryFixture();
    expect(result.violations.filter(
      (violation) =>
        violation.check === MODULE_INTERNAL_LEAKS_RULE_ID &&
        violation.evidence.messageId === InternalLeakMessageIds.MODULE_REFERENCE
    )).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ file: "src/index.ts" }),
        evidence: expect.objectContaining({
          engine: "module-boundaries",
          symbol: "./feature/index.ts"
        }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("src/feature")
        })
      }),
      expect.objectContaining({
        location: expect.objectContaining({ file: "src/index.ts" }),
        evidence: expect.objectContaining({
          engine: "module-boundaries",
          symbol: "./feature/internal.ts"
        }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("src/feature")
        })
      }),
      expect.objectContaining({
        evidence: expect.objectContaining({ symbol: "./feature/nested" }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("src/feature")
        })
      }),
      expect.objectContaining({
        evidence: expect.objectContaining({ symbol: "./tsx-view/index.tsx" }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("src/tsx-view")
        })
      })
    ]);
    expect(result.violations.filter(
      (violation) =>
        violation.check === MODULE_INTERNAL_LEAKS_RULE_ID &&
        violation.evidence.messageId === InternalLeakMessageIds.PACKAGE_EXPORT
    )).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ file: "package.json" }),
        evidence: expect.objectContaining({ symbol: "./src/feature/internal.ts" })
      })
    ]);
  });

  it("rejects index-only wrapper modules", async () => {
    const result = await analyzeModuleBoundaryFixture();
    expect(result.violations.filter(
      (violation) =>
        violation.check === MODULE_INTERNAL_LEAKS_RULE_ID &&
        violation.evidence.messageId ===
          InternalLeakMessageIds.REDUNDANT_MODULE_DIRECTORY
    )).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ file: "src/singleton/index.ts" }),
        remediation: expect.objectContaining({
          instruction: expect.stringContaining("src/singleton.ts")
        })
      })
    ]);
  });
});
