import { convertPlainTextToDoc } from './plain-text-to-doc.converter.js';

describe('convertPlainTextToDoc', () => {
  it('splits paragraphs on blank lines', () => {
    const doc = convertPlainTextToDoc('First paragraph.\n\nSecond paragraph.');

    expect(doc).toEqual({
      type: 'doc',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'First paragraph.' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Second paragraph.' }],
        },
      ],
    });
  });

  it('drops blank paragraphs from extra blank lines', () => {
    const doc = convertPlainTextToDoc('One.\n\n\n\nTwo.');

    expect(doc.children).toHaveLength(2);
  });
});
