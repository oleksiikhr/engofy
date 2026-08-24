import { InvalidNodeTreeError } from '../errors/invalid-node-tree.error.js';
import { parseDoc } from './node-tree.parser.js';

describe('parseDoc', () => {
  it('parses a valid doc with text and span nodes', () => {
    const doc = parseDoc({
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'The government announced ' },
            {
              type: 'span',
              text: 'negotiate',
              kind: 'word',
              wordDefinitionId: 'wd-1',
              pos: 'verb',
            },
          ],
        },
      ],
    });

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'The government announced ' },
          {
            type: 'span',
            text: 'negotiate',
            kind: 'word',
            wordDefinitionId: 'wd-1',
            pos: 'verb',
          },
        ],
      },
    ]);
  });

  it('parses a heading paragraph with a level', () => {
    const doc = parseDoc({
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          level: 2,
          children: [{ type: 'text', text: 'Title' }],
        },
      ],
    });

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        level: 2,
        children: [{ type: 'text', text: 'Title' }],
      },
    ]);
  });

  it('rejects an invalid heading level', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [{ type: 'paragraph', level: 9, children: [] }],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('parses text/span marks', () => {
    const doc = parseDoc({
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'bold', marks: ['bold'] }],
        },
      ],
    });

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'bold', marks: ['bold'] }],
      },
    ]);
  });

  it('rejects an invalid mark', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'x', marks: ['underline'] }],
          },
        ],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('parses a link node', () => {
    const doc = parseDoc({
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'link', text: 'docs', href: 'https://example.com' },
          ],
        },
      ],
    });

    expect(doc.children).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'link', text: 'docs', href: 'https://example.com' }],
      },
    ]);
  });

  it('rejects a link node missing href', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [
          { type: 'paragraph', children: [{ type: 'link', text: 'docs' }] },
        ],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('parses a list block', () => {
    const doc = parseDoc({
      type: 'doc',
      children: [
        {
          type: 'list',
          ordered: true,
          items: [{ children: [{ type: 'text', text: 'Item' }] }],
        },
      ],
    });

    expect(doc.children).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [{ children: [{ type: 'text', text: 'Item' }] }],
      },
    ]);
  });

  it('rejects a list block missing "ordered"', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [{ type: 'list', items: [] }],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('rejects a root without type "doc"', () => {
    expect(() => parseDoc({ children: [] })).toThrow(InvalidNodeTreeError);
  });

  it('rejects a doc missing a children array', () => {
    expect(() => parseDoc({ type: 'doc' })).toThrow(InvalidNodeTreeError);
  });

  it('rejects an unknown block type', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [{ type: 'blockquote', children: [] }],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('rejects an unknown node type', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [
          { type: 'paragraph', children: [{ type: 'image', src: 'x' }] },
        ],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('rejects an unknown span kind', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'span', text: 'x', kind: 'bogus' }],
          },
        ],
      }),
    ).toThrow(InvalidNodeTreeError);
  });

  it('rejects a span node missing text', () => {
    expect(() =>
      parseDoc({
        type: 'doc',
        children: [
          { type: 'paragraph', children: [{ type: 'span', kind: 'word' }] },
        ],
      }),
    ).toThrow(InvalidNodeTreeError);
  });
});
