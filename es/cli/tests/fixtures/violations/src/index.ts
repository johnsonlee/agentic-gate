import { liveValue } from "./shared.ts";

try {
  // eslint-disable-next-line unicorn/no-duplicate-logical-operands
  if (liveValue || liveValue) console.log(liveValue);
  // eslint-disable-next-line agentic-gate/no-silent-catch
} catch (error) {
}
