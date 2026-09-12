import type { Doc, Node } from './node-tree.types.js';

function inlineText(children: Node[]): string {
  return children.map((node) => node.text).join('');
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// A markdown post whose body opens with `# Same text as the title` renders the
// title twice — once from `post.title` in the reader header, once as a body
// heading. Drop that leading level-1 heading when it just repeats the title.
// Leaves the heading in place when there is no title or the text differs, so a
// title-less post keeps its only heading.
export function stripRedundantTitleHeading(
  doc: Doc,
  title: string | null,
): Doc {
  if (!title) {
    return doc;
  }
  const [first] = doc.children;
  if (
    first?.type === 'paragraph' &&
    first.level === 1 &&
    normalize(inlineText(first.children)) === normalize(title)
  ) {
    return { ...doc, children: doc.children.slice(1) };
  }
  return doc;
}
