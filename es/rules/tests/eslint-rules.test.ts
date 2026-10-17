import typescriptParser from "@typescript-eslint/parser";
import {
  noConsecutivePushStringLiterals,
  noDuplicatedImports,
  noHardcodedStringComparisons,
  noMagicNumbers,
  noMisnamedConstantObjects,
  noUnchangedParameterForwarding,
  noUnreviewableStringLiterals,
  noUnusedCode,
  noWildcardExports
} from "../src";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-consecutive-push-string-literals", noConsecutivePushStringLiterals, {
  valid: [
    "values.push('first');",
    "values.push('first', 'second');",
    "values.push('first'); other(); values.push('second');",
    "first.push('value'); second.push('value');",
    "values.push(...NAMED_VALUES); values.push('last');"
  ],
  invalid: [
    {
      code: "values.push('first');\nvalues.push('second');",
      errors: [{ messageId: "CONSECUTIVE_PUSH_STRING_LITERALS", line: 2 }]
    },
    {
      code: "function add() { values['push']('first'); values.push('second'); values.push('third'); }",
      errors: [{ messageId: "CONSECUTIVE_PUSH_STRING_LITERALS" }]
    }
  ]
});

ruleTester.run("no-duplicated-imports", noDuplicatedImports, {
  valid: [
    "import value, { other } from 'module-a';",
    "import('module-a'); import('module-a');",
    "import { value } from 'module-a'; export { other } from 'module-a';"
  ],
  invalid: [
    {
      code: "import { first } from 'module-a';\nimport { second } from 'module-a';",
      errors: [{ messageId: "DUPLICATE_IMPORT", line: 2 }]
    },
    {
      code: "import type { First } from 'module-a';\nimport { second } from 'module-a';",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "DUPLICATE_IMPORT", line: 2 }]
    }
  ]
});

ruleTester.run("no-hardcoded-string-comparisons", noHardcodedStringComparisons, {
  valid: [
    "const READY = 'ready'; if (status === READY) start();",
    "const EMPTY = ''; if (value !== EMPTY) clear();",
    "if (count === 1) increment();",
    "if (value === `prefix-${suffix}`) use(value);",
    "use('ready');",
    "const READY = 'ready'; switch (status) { case READY: start(); }"
  ],
  invalid: [
    {
      code: "if (status === 'ready') start();",
      errors: [{ messageId: "HARDCODED_STRING_COMPARISON", column: 16 }]
    },
    {
      code: "if ('ready' !== status) stop();",
      errors: [{ messageId: "HARDCODED_STRING_COMPARISON", column: 5 }]
    },
    {
      code: "if (version < `v2`) upgrade();",
      errors: [{ messageId: "HARDCODED_STRING_COMPARISON", column: 15 }]
    },
    {
      code: "if (status === ('ready' as const)) start();",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "HARDCODED_STRING_COMPARISON" }]
    },
    {
      code: "switch (status) { case 'ready': start(); }",
      errors: [{ messageId: "HARDCODED_STRING_COMPARISON" }]
    },
    {
      code: "if ('left' === 'right') fail();",
      errors: [
        { messageId: "HARDCODED_STRING_COMPARISON" },
        { messageId: "HARDCODED_STRING_COMPARISON" }
      ]
    }
  ]
});

ruleTester.run("no-magic-numbers", noMagicNumbers, {
  valid: [
    "use(-1, 0, 1);",
    "const NOT_FOUND = 404; request(NOT_FOUND);",
    "values[2]; const RADIX = 10; parseInt(text, RADIX); const settings = { timeout: 5000 };",
    {
      code: "type Port = 8080; enum Status { Ready = 2 } const Settings = { TIMEOUT: 5000 } as const; class Limits { readonly MAX = 10; }",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    }
  ],
  invalid: [
    { code: "sleep(5000);", errors: [{ messageId: "MAGIC_NUMBER" }] },
    { code: "parseInt(text, 10);", errors: [{ messageId: "MAGIC_NUMBER" }] },
    { code: "if (status === 404) fail();", errors: [{ messageId: "MAGIC_NUMBER" }] },
    { code: "let timeout = -42;", errors: [{ messageId: "MAGIC_NUMBER" }] },
    {
      code: "function retry(count: number = 3) { return count; }",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "MAGIC_NUMBER" }]
    }
  ]
});

ruleTester.run("no-misnamed-constant-objects", noMisnamedConstantObjects, {
  valid: [
    {
      code: "export const GateConfigValues = { AUTO_ENTRIES: 'auto', HTTP_2: 'h2' } as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    },
    "const config = { autoEntries: 'auto' };",
    {
      code: "const config = { autoEntries: 'auto' } as Config;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    },
    {
      code: "const values = ['first', 'second'] as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    },
    {
      code: "const ConstantValues = { [dynamic]: value } as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    },
    {
      code: "let GateConfigValues = { autoEntries: 'auto' } as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    }
  ],
  invalid: [
    {
      code: "export const gateConfigValues = { AUTO_ENTRIES: 'auto' } as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "CONSTANT_OBJECT_NAME", column: 14 }]
    },
    {
      code: "const GateConfigValues = { autoEntries: 'auto', 'error-check': 'error' } as const;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [
        { messageId: "CONSTANT_FIELD_NAME", column: 28 },
        { messageId: "CONSTANT_FIELD_NAME", column: 49 }
      ]
    },
    {
      code: "const ConstantValues = { lowerCase: 'value' } as const satisfies Record<string, string>;",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "CONSTANT_FIELD_NAME" }]
    }
  ]
});

const REVIEWABLE_STRING_PREFIX = "const value = '";
const REVIEWABLE_STRING_SUFFIX = "';";
const GITHUB_REVIEWABLE_LINE_LENGTH = 1023;
const GITHUB_UNREVIEWABLE_LINE_LENGTH = 1024;

function stringLineOfLength(length: number): string {
  return REVIEWABLE_STRING_PREFIX + "x".repeat(
    length - REVIEWABLE_STRING_PREFIX.length - REVIEWABLE_STRING_SUFFIX.length
  ) + REVIEWABLE_STRING_SUFFIX;
}

ruleTester.run("no-unreviewable-string-literals", noUnreviewableStringLiterals, {
  valid: [stringLineOfLength(GITHUB_REVIEWABLE_LINE_LENGTH)],
  invalid: [{
    code: stringLineOfLength(GITHUB_UNREVIEWABLE_LINE_LENGTH),
    errors: [{ messageId: "UNREVIEWABLE_STRING_LITERAL" }]
  }]
});

ruleTester.run("no-unchanged-parameter-forwarding", noUnchangedParameterForwarding, {
  valid: [
    "function wrap(value) { return target(value + 1); }",
    "function wrap(value) { log(value); return target(value); }",
    "function wrap(value = 1) { return target(value); }",
    "class Child extends Parent { constructor(value) { super(value); } }",
    "values.map((value) => target(value));"
  ],
  invalid: [
    {
      code: "function wrap(first, second) { return target(second, first); }",
      errors: [{ messageId: "UNCHANGED_FORWARDING" }]
    },
    {
      code: "const wrap = () => target();",
      errors: [{ messageId: "UNCHANGED_FORWARDING" }]
    },
    {
      code: "const wrap = async (value: string) => await target(value);",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "UNCHANGED_FORWARDING" }]
    }
  ]
});

ruleTester.run("no-unused-code", noUnusedCode, {
  valid: [
    "export function use(value) { return value; }",
    {
      code: "export function use(value: string): string { return value; }",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    }
  ],
  invalid: [
    {
      code: "import { unused } from 'module-a'; const local = 1;",
      errors: [{ messageId: "unusedVar", suggestions: 1 }, { messageId: "unusedVar", suggestions: 0 }]
    },
    {
      code: "function use(first: string, second: string): string { return second; } use('a', 'b');",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "unusedVar" }]
    }
  ]
});

ruleTester.run("no-wildcard-exports", noWildcardExports, {
  valid: [
    "export { publicValue } from './internal.ts';",
    {
      code: "export type { PublicType } from './internal.ts';",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser }
    }
  ],
  invalid: [
    {
      code: "export * from './internal.ts';",
      errors: [{ messageId: "WILDCARD_EXPORT" }]
    },
    {
      code: "export type * from './internal.ts';",
      filename: "input.ts",
      languageOptions: { parser: typescriptParser },
      errors: [{ messageId: "WILDCARD_EXPORT" }]
    }
  ]
});
