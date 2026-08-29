import type { Doc } from '../domain/node-tree.types.js';
import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { convertHtmlToDoc } from './html-to-doc.converter.js';
import { convertMarkdownToDoc } from './markdown-to-doc.converter.js';
import { convertPlainTextToDoc } from './plain-text-to-doc.converter.js';

export function convertToDoc(format: PostSourceFormat, rawText: string): Doc {
  switch (format) {
    case PostSourceFormat.Text:
      return convertPlainTextToDoc(rawText);
    case PostSourceFormat.Markdown:
      return convertMarkdownToDoc(rawText);
    case PostSourceFormat.Html:
      return convertHtmlToDoc(rawText);
  }
}
