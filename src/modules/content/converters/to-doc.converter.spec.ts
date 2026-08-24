import { ContentSourceFormat } from '../enums/content-source-format.enum.js';
import { convertToDoc } from './to-doc.converter.js';

describe('convertToDoc', () => {
  it('dispatches plain text to the text converter', () => {
    const doc = convertToDoc(ContentSourceFormat.Text, 'Hello world.');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });

  it('dispatches markdown to the markdown converter', () => {
    const doc = convertToDoc(ContentSourceFormat.Markdown, 'Hello world.');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });

  it('dispatches html to the html converter', () => {
    const doc = convertToDoc(ContentSourceFormat.Html, '<p>Hello world.</p>');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });
});
