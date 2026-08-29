import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { convertToDoc } from './to-doc.converter.js';

describe('convertToDoc', () => {
  it('dispatches plain text to the text converter', () => {
    const doc = convertToDoc(PostSourceFormat.Text, 'Hello world.');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });

  it('dispatches markdown to the markdown converter', () => {
    const doc = convertToDoc(PostSourceFormat.Markdown, 'Hello world.');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });

  it('dispatches html to the html converter', () => {
    const doc = convertToDoc(PostSourceFormat.Html, '<p>Hello world.</p>');

    expect(doc.children).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world.' }] },
    ]);
  });
});
