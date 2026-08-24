import { convertHtmlToDoc } from './html-to-doc.converter.js';

describe('convertHtmlToDoc', () => {
  it('extracts <p> tag text as paragraphs', () => {
    const doc = convertHtmlToDoc(
      '<div><p>First paragraph.</p><p>Second paragraph.</p></div>',
    );

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'First paragraph.' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Second paragraph.' }],
      },
    ]);
  });

  it('converts a heading tag to a paragraph with a level', () => {
    const doc = convertHtmlToDoc('<h1>Title</h1><p>Body.</p>');

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        level: 1,
        children: [{ type: 'text', text: 'Title' }],
      },
      { type: 'paragraph', children: [{ type: 'text', text: 'Body.' }] },
    ]);
  });

  it('preserves <b>/<strong> and <i>/<em> as marks on text nodes', () => {
    const doc = convertHtmlToDoc(
      '<p>Plain <strong>bold</strong> and <em>italic</em> text.</p>',
    );

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Plain ' },
          { type: 'text', text: 'bold', marks: ['bold'] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: ['italic'] },
          { type: 'text', text: ' text.' },
        ],
      },
    ]);
  });

  it('converts <a> tags to LinkNode with href', () => {
    const doc = convertHtmlToDoc(
      '<p>See <a href="https://example.com/docs">the docs</a> for more.</p>',
    );

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'See ' },
          { type: 'link', text: 'the docs', href: 'https://example.com/docs' },
          { type: 'text', text: ' for more.' },
        ],
      },
    ]);
  });

  it('converts <ul>/<ol> to a ListBlock', () => {
    const doc = convertHtmlToDoc(
      '<ul><li>First item</li><li>Second item</li></ul>',
    );

    expect(doc.children).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { children: [{ type: 'text', text: 'First item' }] },
          { children: [{ type: 'text', text: 'Second item' }] },
        ],
      },
    ]);
  });

  it('marks an <ol> list as ordered', () => {
    const doc = convertHtmlToDoc('<ol><li>First</li><li>Second</li></ol>');

    expect(doc.children).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          { children: [{ type: 'text', text: 'First' }] },
          { children: [{ type: 'text', text: 'Second' }] },
        ],
      },
    ]);
  });
});
