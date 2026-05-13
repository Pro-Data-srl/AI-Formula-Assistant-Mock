/**
 * User-visible text from LangChain stream chunks / message `content`.
 *
 * LangChain normalizes provider output to string or {@link https://docs.langchain.com/oss/javascript/langchain/messages#message-content content blocks}.
 * The supported way to turn that into plain text in a chain is {@link StringOutputParser}
 * (`model.pipe(new StringOutputParser())`); there is no separate exported `contentToString` helper.
 * We reuse the same coercion rules via a thin subclass so call sites can pass `chunk.content` synchronously.
 *
 * @see https://reference.langchain.com/javascript/classes/_langchain_core.output_parsers.StringOutputParser.html
 */

import { StringOutputParser } from "@langchain/core/output_parsers";
import type { MessageContent } from "@langchain/core/messages";

class MessageContentTextParser extends StringOutputParser {
  textFromContent(content: MessageContent | undefined): string {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    try {
      return this._baseMessageContentToString(content);
    } catch {
      // StringOutputParser throws on unknown block types (e.g. partial tool payloads); streaming stays resilient.
      return "";
    }
  }
}

const messageContentTextParser = new MessageContentTextParser();

export function langchainMessageContentToText(content: unknown): string {
  return messageContentTextParser.textFromContent(content as MessageContent);
}
