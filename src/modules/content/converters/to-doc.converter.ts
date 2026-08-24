import type { Doc } from '../domain/node-tree.types.js';
import { ContentSourceFormat } from '../enums/content-source-format.enum.js';
import { convertHtmlToDoc } from './html-to-doc.converter.js';
import { convertMarkdownToDoc } from './markdown-to-doc.converter.js';
import { convertPlainTextToDoc } from './plain-text-to-doc.converter.js';

export function convertToDoc(
  format: ContentSourceFormat,
  rawText: string,
): Doc {
  switch (format) {
    case ContentSourceFormat.Text:
      return convertPlainTextToDoc(rawText);
    case ContentSourceFormat.Markdown:
      return convertMarkdownToDoc(rawText);
    case ContentSourceFormat.Html:
      return convertHtmlToDoc(rawText);
  }
}
