import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

/** Treat customer, scraped and AI-generated Markdown as untrusted input. */
export function renderSafeMarkdown(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, { async: false, gfm: true }) as string, {
    allowedTags: [
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "em",
      "del",
      "blockquote",
      "ul",
      "ol",
      "li",
      "pre",
      "code",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: { a: ["href", "title"], ol: ["start"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  });
}
