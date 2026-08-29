// Deliberately tiny Markdown -> HTML for the grammar cheat sheets, which the
// Nest EGP importer emits in a fixed narrow shape: `## Form`, a blank line,
// then `- **label** — LEVEL — text` bullets (plus the odd heading / `code` /
// **bold** in hand-written samples). Not a general Markdown engine — enough
// for that content, with everything escaped.

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

function inline(text: string): string {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let list: string[] | null = null;
  let para: string[] = [];

  const flushList = () => {
    if (list) {
      html.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
      list = null;
    }
  };
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);

    if (heading) {
      flushList();
      flushPara();
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      flushPara();
      if (!list) {
        list = [];
      }
      list.push(inline(bullet[1]));
    } else if (trimmed === '') {
      flushList();
      flushPara();
    } else {
      flushList();
      para.push(trimmed);
    }
  }
  flushList();
  flushPara();
  return html.join('\n');
}
