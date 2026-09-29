// Clickable words on a handcrafted grammar page (server only — node:crypto).
//
// The page's rendered body HTML is split into text blocks (a paragraph, a
// list item, an example…): runs of text between block-level tags, skipping
// text a learner shouldn't look up (links, buttons, summaries, code, native-
// language text, `[data-no-lex]`). The backend's `grammar annotate-pages`
// gets the blocks from `/grammar/lex-blocks.json` and stores word spans per
// block, keyed by `lexBlockHash` of the block text; the page then wraps those
// words in `[data-word-definition-id]` spans on the server, so they are there
// before first paint.
import { createHash } from 'node:crypto';

function escAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

// Must match the backend's lexBlockHash (src/modules/post/domain/lex-block.ts).
export function lexBlockHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

// Around a handcrafted page's body in the rendered HTML (GrammarShell).
export const LEX_ROOT_START = '<!--lex-root-->';
export const LEX_ROOT_END = '<!--/lex-root-->';

// The text blocks of a rendered handcrafted page — empty for a page without
// the markers (the generic fallback page).
export function extractPageLexBlocks(pageHtml: string): string[] {
  const start = pageHtml.indexOf(LEX_ROOT_START);
  const end = pageHtml.indexOf(LEX_ROOT_END, start);
  return start === -1 || end === -1
    ? []
    : extractLexBlocks(pageHtml.slice(start + LEX_ROOT_START.length, end));
}

// A stored span: a word sense or a phrase, as a range in the block's text.
export type LexSpan = { start: number; end: number } & (
  | { wordDefinitionId: string }
  | { phraseId: string }
);

// Inline tags keep a block going; any other tag ends it.
const INLINE = new Set([
  'abbr',
  'b',
  'bdi',
  'bdo',
  'cite',
  'data',
  'dfn',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
]);
// Their text is never looked up; they also end the block around them.
const SKIP = new Set([
  'a',
  'button',
  'code',
  'label',
  'option',
  'pre',
  'script',
  'select',
  'style',
  'summary',
  'svg',
  'template',
  'textarea',
]);
const VOID = new Set([
  'area',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const PIECE_RE = /<!--[\s\S]*?-->|<[^>]*>|[^<]+/g;
const TAG_RE = /^<\/?\s*([a-zA-Z][\w-]*)/;
const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g;
const WS_RE = /\s/;
const LETTER_RE = /\p{L}/u;

// One decoded character of a text piece and where it sits in the raw HTML.
interface Char {
  ch: string;
  piece: number;
  // Raw offsets of this character within its piece (an entity spans several).
  rawStart: number;
  rawEnd: number;
}

interface Block {
  text: string;
  // chars[i] is the source of text[i].
  chars: Char[];
}

function decode(raw: string, piece: number): Char[] {
  const out: Char[] = [];
  let last = 0;
  const push = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      out.push({ ch: raw[i] as string, piece, rawStart: i, rawEnd: i + 1 });
    }
  };
  for (const match of raw.matchAll(ENTITY_RE)) {
    const body = match[1] as string;
    const at = match.index ?? 0;
    const value = body.startsWith('#x')
      ? String.fromCodePoint(Number.parseInt(body.slice(2), 16))
      : body.startsWith('#')
        ? String.fromCodePoint(Number.parseInt(body.slice(1), 10))
        : NAMED[body];
    if (value === undefined) {
      continue;
    }
    push(last, at);
    out.push({
      ch: value,
      piece,
      rawStart: at,
      rawEnd: at + match[0].length,
    });
    last = at + match[0].length;
  }
  push(last, raw.length);
  return out;
}

// Collapses whitespace runs to one space and trims, keeping each kept
// character's source.
function toBlock(chars: Char[]): Block | null {
  const kept: Char[] = [];
  let pendingSpace: Char | null = null;
  for (const c of chars) {
    if (WS_RE.test(c.ch)) {
      pendingSpace ??= c;
      continue;
    }
    if (pendingSpace && kept.length > 0) {
      kept.push({ ...pendingSpace, ch: ' ' });
    }
    pendingSpace = null;
    kept.push(c);
  }
  return kept.length > 0
    ? { text: kept.map((c) => c.ch).join(''), chars: kept }
    : null;
}

function isSkipped(tag: string, attrs: string): boolean {
  if (SKIP.has(tag) || attrs.includes('data-no-lex')) {
    return true;
  }
  const lang = attrs.match(/\slang="([^"]*)"/)?.[1];
  return lang !== undefined && lang !== 'en';
}

// Walks the HTML once, returning its pieces and the text blocks in order.
function scan(html: string): { pieces: string[]; blocks: Block[] } {
  const pieces = html.match(PIECE_RE) ?? [];
  const blocks: Block[] = [];
  // Open elements as [tag, skipped]; text is skipped while any is.
  const stack: [string, boolean][] = [];
  let skipDepth = 0;
  let current: Char[] = [];
  const flush = () => {
    const block = toBlock(current);
    // A block with no letter ("+", "→", a number) has no word to look up.
    if (block && LETTER_RE.test(block.text)) {
      blocks.push(block);
    }
    current = [];
  };

  pieces.forEach((piece, index) => {
    if (!piece.startsWith('<')) {
      if (skipDepth === 0) {
        current.push(...decode(piece, index));
      }
      return;
    }
    if (piece.startsWith('<!--')) {
      return;
    }
    const tag = piece.match(TAG_RE)?.[1]?.toLowerCase();
    if (!tag) {
      return;
    }
    const closing = piece.startsWith('</');
    if (!INLINE.has(tag)) {
      flush();
    }
    if (closing) {
      // Pop to the matching open tag (tolerates an unclosed inline child).
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.[0] === tag) {
          for (const [, skipped] of stack.splice(i)) {
            if (skipped) {
              skipDepth--;
            }
          }
          break;
        }
      }
      return;
    }
    if (VOID.has(tag) || piece.endsWith('/>')) {
      return;
    }
    const skipped = isSkipped(tag, piece);
    if (skipped) {
      skipDepth++;
    }
    stack.push([tag, skipped]);
  });
  flush();
  return { pieces, blocks };
}

// The text blocks of a page body, as `grammar annotate-pages` stores them.
export function extractLexBlocks(html: string): string[] {
  return scan(html).blocks.map((block) => block.text);
}

// The page body with every stored word / phrase wrapped in a clickable span.
// A block that changed since the page was annotated has no spans (its hash
// doesn't match); a span that would cross a tag is left out.
export function wrapLexWords(
  html: string,
  blocks: Record<string, LexSpan[]>,
): string {
  const { pieces, blocks: found } = scan(html);
  // Per piece: [rawStart, rawEnd, span attribute], in order.
  const inserts = new Map<number, [number, number, string][]>();
  for (const block of found) {
    const spans = blocks[lexBlockHash(block.text)] ?? [];
    for (const span of spans) {
      const first = block.chars[span.start];
      const last = block.chars[span.end - 1];
      if (!first || !last || first.piece !== last.piece) {
        continue;
      }
      const attribute =
        'wordDefinitionId' in span
          ? `data-word-definition-id="${escAttr(span.wordDefinitionId)}"`
          : `data-phrase-id="${escAttr(span.phraseId)}"`;
      const list = inserts.get(first.piece) ?? [];
      list.push([first.rawStart, last.rawEnd, attribute]);
      inserts.set(first.piece, list);
    }
  }
  return pieces
    .map((piece, index) => {
      const list = inserts.get(index);
      if (!list) {
        return piece;
      }
      let out = '';
      let at = 0;
      for (const [start, end, attribute] of list.sort((a, b) => a[0] - b[0])) {
        if (start < at) {
          continue;
        }
        out += `${piece.slice(at, start)}<span class="lex-word" ${attribute}>${piece.slice(start, end)}</span>`;
        at = end;
      }
      return out + piece.slice(at);
    })
    .join('');
}
