import { ContentSourceFormat } from '../enums/content-source-format.enum.js';
import { detectContentSourceFormat } from './detect-content-source-format.js';

describe('detectContentSourceFormat', () => {
  it('detects html from a paragraph tag', () => {
    expect(detectContentSourceFormat('<p>Hello world</p>')).toBe(
      ContentSourceFormat.Html,
    );
  });

  it('detects html from a heading and a list', () => {
    expect(
      detectContentSourceFormat(
        '<h1>Title</h1><ul><li>One</li><li>Two</li></ul>',
      ),
    ).toBe(ContentSourceFormat.Html);
  });

  it('detects markdown from an ATX heading', () => {
    expect(detectContentSourceFormat('# Title\n\nSome text.')).toBe(
      ContentSourceFormat.Markdown,
    );
  });

  it('detects markdown from a bullet list', () => {
    expect(detectContentSourceFormat('- First item\n- Second item')).toBe(
      ContentSourceFormat.Markdown,
    );
  });

  it('detects markdown from a numbered list', () => {
    expect(detectContentSourceFormat('1. First\n2. Second')).toBe(
      ContentSourceFormat.Markdown,
    );
  });

  it('detects markdown from bold text', () => {
    expect(detectContentSourceFormat('This is **bold** text.')).toBe(
      ContentSourceFormat.Markdown,
    );
  });

  it('detects markdown from a link', () => {
    expect(
      detectContentSourceFormat('See [the docs](https://example.com).'),
    ).toBe(ContentSourceFormat.Markdown);
  });

  it('falls back to plain text', () => {
    expect(detectContentSourceFormat('Just a plain paragraph of text.')).toBe(
      ContentSourceFormat.Text,
    );
  });

  it('does not misdetect a stray "<" comparison as html', () => {
    expect(detectContentSourceFormat('if x < 5 then stop')).toBe(
      ContentSourceFormat.Text,
    );
  });
});
