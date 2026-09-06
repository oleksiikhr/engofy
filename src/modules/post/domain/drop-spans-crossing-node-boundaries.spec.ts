import { dropSpansCrossingNodeBoundaries } from './drop-spans-crossing-node-boundaries.js';
import { flattenNodes } from './flatten.js';
import type { Node } from './node-tree.types.js';
import type { Annotation } from './validate-annotations.js';

describe('dropSpansCrossingNodeBoundaries', () => {
  // "Start looking for an apartment " (plain) + "at least" (bold) + " two months in advance." (plain)
  const children: Node[] = [
    { type: 'text', text: 'Start looking for an apartment ' },
    { type: 'text', text: 'at least', marks: ['bold'] },
    { type: 'text', text: ' two months in advance.' },
  ];
  const { offsets } = flattenNodes(children);

  const boldNode = offsets[1] as (typeof offsets)[number];

  it('drops a span that straddles a node boundary', () => {
    // Starts inside the bold "at least" node, ends 10 chars into the
    // following plain node.
    const annotations: Annotation[] = [
      {
        start: boldNode.start,
        end: boldNode.end + 10,
        form: 'at least two months',
        kind: 'phrase',
        phraseText: 'at least',
        phraseGroupId: 'g1',
      },
    ];

    expect(dropSpansCrossingNodeBoundaries(offsets, annotations)).toHaveLength(
      0,
    );
  });

  it('keeps a span that falls entirely within one node', () => {
    const annotations: Annotation[] = [
      {
        start: boldNode.start,
        end: boldNode.end,
        form: 'at least',
        kind: 'phrase',
        phraseText: 'at least',
        phraseGroupId: 'g1',
      },
    ];

    expect(dropSpansCrossingNodeBoundaries(offsets, annotations)).toHaveLength(
      1,
    );
  });

  it('drops a span that falls inside a link node (keeps the link atomic)', () => {
    const linkChildren: Node[] = [
      { type: 'text', text: 'Read it on ' },
      { type: 'link', text: "the author's site", href: 'https://example.com' },
      { type: 'text', text: ' instead.' },
    ];
    const flattened = flattenNodes(linkChildren);
    const linkNode = flattened.offsets[1];

    // "author" — entirely within the link node's text.
    const annotations: Annotation[] = [
      {
        start: linkNode.start + 4,
        end: linkNode.start + 10,
        form: 'author',
        kind: 'word',
        pos: 'noun',
        lemma: 'author',
      },
    ];

    expect(
      dropSpansCrossingNodeBoundaries(flattened.offsets, annotations),
    ).toHaveLength(0);
  });
});
