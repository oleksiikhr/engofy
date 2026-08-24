import { convertMarkdownToDoc } from './markdown-to-doc.converter.js';

describe('convertMarkdownToDoc', () => {
  it('extracts paragraphs and preserves heading level', () => {
    const doc = convertMarkdownToDoc(
      '# Title\n\nFirst paragraph.\n\nSecond paragraph.',
    );

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        level: 1,
        children: [{ type: 'text', text: 'Title' }],
      },
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

  it('preserves bold and italic as marks on text nodes', () => {
    const doc = convertMarkdownToDoc('Plain **bold** and *italic* text.');

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

  it('converts links to LinkNode with href', () => {
    const doc = convertMarkdownToDoc(
      'See [the docs](https://example.com/docs) for more.',
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

  it('converts an unordered list to a ListBlock', () => {
    const doc = convertMarkdownToDoc('- First item\n- Second item');

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

  it('marks an ordered list as ordered', () => {
    const doc = convertMarkdownToDoc('1. First\n2. Second');

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
