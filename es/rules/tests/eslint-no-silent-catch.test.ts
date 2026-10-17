import typescriptParser from "@typescript-eslint/parser";
import { noSilentCatch } from "../src";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-silent-catch", noSilentCatch, {
  valid: [
    "try { run(); } catch (error) { console.error(error); }",
    "try { run(); } catch (error) { throw error; }",
    "try { run(); } catch (error) { savedError = error; }",
    "try { run(); } finally { cleanup(); }",
    "read().catch((error) => report(error));",
    "read().catch((error) => { throw error; });",
    "read().catch(handleError);",
    {
      code: "function read(value: string): void { try { use(value); } catch (error) { throw error; } }",
      filename: "input.ts",
      languageOptions: {
        parser: typescriptParser
      }
    }
  ],
  invalid: [
    {
      code: "try { run(); } catch (error) {}",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "try { run(); } catch {}",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "try { run(); } catch (error) { /* ignored */ }",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "try { run(); } catch (error) { recover(); }",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "try { run(); } catch (error) { error = replacement; }",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "function read() { try { run(); } catch (error) { return null; } }",
      errors: [{ messageId: "SILENT_CATCH" }]
    },
    {
      code: "function read(value: string): void { try { use(value); } catch {} }",
      filename: "input.ts",
      languageOptions: {
        parser: typescriptParser
      },
      errors: [{ messageId: "SILENT_CATCH" }]
    }
  ]
});
