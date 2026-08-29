import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { detectPostSourceFormat } from './detect-post-source-format.js';

describe('detectPostSourceFormat', () => {
  it('detects html from a paragraph tag', () => {
    expect(detectPostSourceFormat('<p>Hello world</p>')).toBe(
      PostSourceFormat.Html,
    );
  });

  it('detects html from a heading and a list', () => {
    expect(
      detectPostSourceFormat('<h1>Title</h1><ul><li>One</li><li>Two</li></ul>'),
    ).toBe(PostSourceFormat.Html);
  });

  it('detects markdown from an ATX heading', () => {
    expect(detectPostSourceFormat('# Title\n\nSome text.')).toBe(
      PostSourceFormat.Markdown,
    );
  });

  it('detects markdown from a bullet list', () => {
    expect(detectPostSourceFormat('- First item\n- Second item')).toBe(
      PostSourceFormat.Markdown,
    );
  });

  it('detects markdown from a numbered list', () => {
    expect(detectPostSourceFormat('1. First\n2. Second')).toBe(
      PostSourceFormat.Markdown,
    );
  });

  it('detects markdown from bold text', () => {
    expect(detectPostSourceFormat('This is **bold** text.')).toBe(
      PostSourceFormat.Markdown,
    );
  });

  it('detects markdown from a link', () => {
    expect(detectPostSourceFormat('See [the docs](https://example.com).')).toBe(
      PostSourceFormat.Markdown,
    );
  });

  it('falls back to plain text', () => {
    expect(detectPostSourceFormat('Just a plain paragraph of text.')).toBe(
      PostSourceFormat.Text,
    );
  });

  it('does not misdetect a stray "<" comparison as html', () => {
    expect(detectPostSourceFormat('if x < 5 then stop')).toBe(
      PostSourceFormat.Text,
    );
  });
});
