import { describe, it } from "bun:test";
import { RuleTester } from "eslint";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = (name, test) => {
  if (process.env.CI) throw new Error("Focused RuleTester cases are disabled in CI.");
  return it.only(name, test);
};

export const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" }
});
