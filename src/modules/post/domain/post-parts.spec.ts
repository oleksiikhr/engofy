import { PostPartKind } from '../enums/post-part-kind.enum.js';
import type { Doc } from './node-tree.types.js';
import { assembleDocFromParts, splitDocIntoParts } from './post-parts.js';

describe('splitDocIntoParts / assembleDocFromParts', () => {
  it('splits a Doc into one part per paragraph and reassembles it unchanged', () => {
    const doc: Doc = {
      type: 'doc',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'First.' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'Second.' }] },
      ],
    };

    const parts = splitDocIntoParts(doc);

    expect(parts).toEqual([
      { blockIndex: 0, kind: PostPartKind.Paragraph, body: doc.children[0] },
      { blockIndex: 1, kind: PostPartKind.Paragraph, body: doc.children[1] },
    ]);
    expect(assembleDocFromParts(parts)).toEqual(doc);
  });

  it('keeps a whole ListBlock (all its items) as a single part', () => {
    const doc: Doc = {
      type: 'doc',
      children: [
        {
          type: 'list',
          ordered: true,
          items: [
            { children: [{ type: 'text', text: 'One.' }] },
            { children: [{ type: 'text', text: 'Two.' }] },
          ],
        },
      ],
    };

    const parts = splitDocIntoParts(doc);

    expect(parts).toEqual([
      { blockIndex: 0, kind: PostPartKind.List, body: doc.children[0] },
    ]);
    expect(assembleDocFromParts(parts)).toEqual(doc);
  });

  it('assembles a Doc from out-of-order parts by blockIndex', () => {
    const parts = [
      {
        blockIndex: 1,
        kind: PostPartKind.Paragraph,
        body: {
          type: 'paragraph' as const,
          children: [{ type: 'text' as const, text: 'Second.' }],
        },
      },
      {
        blockIndex: 0,
        kind: PostPartKind.Paragraph,
        body: {
          type: 'paragraph' as const,
          children: [{ type: 'text' as const, text: 'First.' }],
        },
      },
    ];

    const doc = assembleDocFromParts(parts);

    expect(
      doc.children.map((block) =>
        block.type === 'paragraph' ? block.children[0] : undefined,
      ),
    ).toEqual([
      { type: 'text', text: 'First.' },
      { type: 'text', text: 'Second.' },
    ]);
  });
});
