/**
 * Reports string and template literals that occupy a source line GitHub
 * cannot render with character-level intra-line diff highlighting. GitHub's
 * public web implementation does not document this boundary, but the open
 * GitHub Desktop implementation uses the same github.com-compatible contract:
 * both line versions must be shorter than 1024 characters.
 *
 * This rule measures complete source lines rather than decoded string values,
 * because the review UI receives lines. A literal is reported once when any
 * line it occupies has 1024 or more UTF-16 code units. The boundary is an
 * external review-tool contract, not a configurable quality threshold.
 *
 * @see https://github.com/desktop/desktop/issues/22556
 * @module
 */

import {
  AstNodeTypes,
  JavaScriptValueTypes
} from "agentic-gate-engine";
import { defineRule } from "./policy.ts";

type Node = { type: string; [key: string]: any };

const Messages = {
  UNREVIEWABLE_STRING_LITERAL:
    "This string occupies a source line that GitHub cannot highlight at character level. Split the source line below 1024 characters."
} as const;

type NoUnreviewableStringLiteralsRule = {
  RuleOptions: [];
  MessageIds: keyof typeof Messages;
};

const GITHUB_INTRA_LINE_DIFF_EXCLUSIVE_LIMIT = 1024;
const SOURCE_LINE_NUMBER_OFFSET = 1;

/** @hidden */
export default defineRule<NoUnreviewableStringLiteralsRule>(import.meta.url, {
  meta: {
    type: "problem",
    docs: {
      description: "Keep string-literal source lines eligible for GitHub intra-line diff highlighting."
    },
    schema: [],
    messages: Messages
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function inspect(node: Node): void {
      if (!node.loc) return;
      const firstLineIndex = node.loc.start.line - SOURCE_LINE_NUMBER_OFFSET;
      const lastLineIndex = node.loc.end.line - SOURCE_LINE_NUMBER_OFFSET;
      const hasUnreviewableLine = sourceCode.lines
        .slice(firstLineIndex, lastLineIndex + SOURCE_LINE_NUMBER_OFFSET)
        .some((line) => line.length >= GITHUB_INTRA_LINE_DIFF_EXCLUSIVE_LIMIT);
      if (!hasUnreviewableLine) return;
      context.report({
        node: node as never,
        messageId: "UNREVIEWABLE_STRING_LITERAL"
      });
    }

    return {
      Literal(node) {
        if (
          node.type === AstNodeTypes.LITERAL &&
          typeof node.value === JavaScriptValueTypes.STRING
        ) inspect(node as Node);
      },
      TemplateLiteral: inspect
    };
  }
});
