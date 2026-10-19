export type PolicyId = `agentic-gate/${string}`;

const A_VALUE = 1;

export function policyId(name: string): string {
  return `agentic-gate/${name}`;
}

export const WORD_ONE = `Identifier${A_VALUE}`;
export const PUNCTUATION_ONE = `${WORD_ONE}:`;
export const QUOTED_PREFIX_ONE = "agentic-gate/";
export const QUERY_ONE = String.raw`select ${A_VALUE} from records`;
export const ESCAPED_ONE = `caf\u0065-${A_VALUE}`;
export const TAGGED_ONE = tag`tagged fragment`;
