import { parseTelegramCommand } from './parse-command.js';

describe('parseTelegramCommand', () => {
  it('parses /add with the rest of the message as the post text', () => {
    expect(
      parseTelegramCommand('/add The quick brown fox.\nSecond line.'),
    ).toEqual({ kind: 'add', text: 'The quick brown fox.\nSecond line.' });
  });

  it('tolerates the @botname suffix Telegram adds in groups', () => {
    expect(parseTelegramCommand('/add@engofy_bot Hello world')).toEqual({
      kind: 'add',
      text: 'Hello world',
    });
  });

  it('parses /retry with a post id', () => {
    expect(
      parseTelegramCommand('/retry 01920000-0000-7000-8000-000000000000'),
    ).toEqual({
      kind: 'retry',
      postId: '01920000-0000-7000-8000-000000000000',
    });
  });

  it('treats /add with no body as unknown', () => {
    expect(parseTelegramCommand('/add   ')).toEqual({ kind: 'unknown' });
  });

  it('treats /retry with no id as unknown', () => {
    expect(parseTelegramCommand('/retry')).toEqual({ kind: 'unknown' });
  });

  it('treats /retry with a non-uuid id as unknown', () => {
    expect(parseTelegramCommand('/retry not-a-uuid')).toEqual({
      kind: 'unknown',
    });
    expect(parseTelegramCommand('/retry 12345')).toEqual({ kind: 'unknown' });
  });

  it('treats a plain message as unknown', () => {
    expect(parseTelegramCommand('hey there')).toEqual({ kind: 'unknown' });
  });

  it('trims surrounding whitespace before matching', () => {
    expect(parseTelegramCommand('  /add  padded text  ')).toEqual({
      kind: 'add',
      text: 'padded text',
    });
  });
});
