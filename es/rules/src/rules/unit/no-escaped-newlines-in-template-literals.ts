/**
 * Reports newline escape sequences inside the content of template literals.
 * Template literals already support real source line breaks, which show the
 * rendered layout to a reviewer without mentally decoding `\n`, `\r`,
 * hexadecimal, or Unicode escapes. Leading and trailing newline escapes are
 * allowed because they express boundary whitespace more clearly than a bare
 * source line. Line continuations are always reported because they make the
 * source appear multiline while removing the line break from the value. A
 * literal backslash followed by `n` or `r` remains valid. An escaped newline
 * used as a delimiter or control character belongs in a quoted string such as
 * `split('\n')`, which is outside this rule.
 *
 * The rule recognizes every ECMAScript escape spelling whose value is line
 * feed or carriage return. Actual source line breaks are allowed. The rule has
 * no options. Tagged templates are excluded because a tag defines how raw and
 * cooked template segments are interpreted, so an escape does not prove a
 * newline value.
 *
 * @example
 * ```ts
 * const hidden = `first\nsecond`; // reported
 * const visible = `first
 * second`;
 * ```
 * @module
 */

import { AstNodeTypes } from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = {
  type: string;
  parent?: { type: string; quasi?: unknown };
  quasis: Array<{ value: { raw: string } }>;
  [key: string]: any;
};

type SourceRange = {
  start: number;
  end: number;
  expressesBoundaryWhitespace: boolean;
};

const Messages = {
  ESCAPED_NEWLINE:
    "A template literal hides an interior line break behind an escape. Use a real source line break for multiline text, or a quoted string when the newline is a delimiter or control character."
} as const;

type NoEscapedNewlinesInTemplateLiteralsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;
const HEX_RADIX = 16;
const BACKSLASH = "\\";
const LINE_FEED_CHARACTER = "\n";
const CARRIAGE_RETURN_CHARACTER = "\r";
const LINE_SEPARATOR_CHARACTER = String.fromCodePoint(LINE_SEPARATOR);
const PARAGRAPH_SEPARATOR_CHARACTER = String.fromCodePoint(PARAGRAPH_SEPARATOR);
const LINE_FEED_ESCAPE = "n";
const CARRIAGE_RETURN_ESCAPE = "r";
const UNICODE_ESCAPE = "u";
const CLOSING_BRACE = "}";
const HEX_ESCAPE_PREFIX = "\\x";
const UNICODE_ESCAPE_PREFIX = "\\u";
const BRACED_UNICODE_ESCAPE_PREFIX = "\\u{";
const HEX_ESCAPE_WIDTH = 2;
const UNICODE_ESCAPE_WIDTH = 4;

function isNewlineCodePoint(value: string): boolean {
  const codePoint = Number.parseInt(value, HEX_RADIX);
  return codePoint === LINE_FEED ||
    codePoint === CARRIAGE_RETURN ||
    codePoint === LINE_SEPARATOR ||
    codePoint === PARAGRAPH_SEPARATOR;
}

function escapedNewlineRanges(raw: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== BACKSLASH) continue;
    const escape = raw[index + 1];
    if (escape === BACKSLASH) {
      index += 1;
      continue;
    }
    let end: number | undefined;
    let expressesBoundaryWhitespace = true;
    if (
      escape === LINE_FEED_CHARACTER ||
      escape === CARRIAGE_RETURN_CHARACTER ||
      escape === LINE_SEPARATOR_CHARACTER ||
      escape === PARAGRAPH_SEPARATOR_CHARACTER
    ) {
      end = index + BACKSLASH.length + escape.length;
      expressesBoundaryWhitespace = false;
      if (
        escape === CARRIAGE_RETURN_CHARACTER &&
        raw[end] === LINE_FEED_CHARACTER
      ) end += 1;
    }
    if (end === undefined) {
      if (escape === LINE_FEED_ESCAPE || escape === CARRIAGE_RETURN_ESCAPE) {
        end = index + BACKSLASH.length + escape.length;
      } else if (raw.startsWith(HEX_ESCAPE_PREFIX, index)) {
        const digitsStart = index + HEX_ESCAPE_PREFIX.length;
        if (isNewlineCodePoint(raw.slice(digitsStart, digitsStart + HEX_ESCAPE_WIDTH))) {
          end = digitsStart + HEX_ESCAPE_WIDTH;
        }
      } else if (escape !== UNICODE_ESCAPE) {
        continue;
      } else if (raw.startsWith(BRACED_UNICODE_ESCAPE_PREFIX, index)) {
        const digitsStart = index + BRACED_UNICODE_ESCAPE_PREFIX.length;
        const closingBrace = raw.indexOf(CLOSING_BRACE, digitsStart);
        if (
          closingBrace !== -1 &&
          isNewlineCodePoint(raw.slice(digitsStart, closingBrace))
        ) end = closingBrace + 1;
      } else {
        const digitsStart = index + UNICODE_ESCAPE_PREFIX.length;
        if (isNewlineCodePoint(raw.slice(digitsStart, digitsStart + UNICODE_ESCAPE_WIDTH))) {
          end = digitsStart + UNICODE_ESCAPE_WIDTH;
        }
      }
    }
    if (end === undefined) continue;
    ranges.push({ start: index, end, expressesBoundaryWhitespace });
    index = end - 1;
  }
  return ranges;
}

function hasInteriorEscapedNewline(
  raw: string,
  allowLeading: boolean,
  allowTrailing: boolean
): boolean {
  const ranges = escapedNewlineRanges(raw);
  let first = 0;
  let last = ranges.length;
  if (allowLeading) {
    let boundary = 0;
    while (
      first < last &&
      ranges[first]?.expressesBoundaryWhitespace === true &&
      ranges[first]?.start === boundary
    ) {
      boundary = ranges[first]?.end ?? boundary;
      first += 1;
    }
  }
  if (allowTrailing) {
    let boundary = raw.length;
    while (
      last > first &&
      ranges[last - 1]?.expressesBoundaryWhitespace === true &&
      ranges[last - 1]?.end === boundary
    ) {
      boundary = ranges[last - 1]?.start ?? boundary;
      last -= 1;
    }
  }
  return first < last;
}

/** @hidden */
export default defineRule<NoEscapedNewlinesInTemplateLiteralsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Require visible source line breaks in template literals."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        const template = node as Node;
        if (
          template.parent?.type === AstNodeTypes.TAGGED_TEMPLATE_EXPRESSION &&
          template.parent.quasi === node
        ) return;
        const lastQuasi = template.quasis.length - 1;
        if (!template.quasis.some((quasi, index) =>
          hasInteriorEscapedNewline(quasi.value.raw, index === 0, index === lastQuasi)
        )) return;
        context.report({ node, messageId: "ESCAPED_NEWLINE" });
      }
    };
  }
});
