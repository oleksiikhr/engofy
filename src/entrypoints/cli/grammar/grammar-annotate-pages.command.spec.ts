import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import type AppConfig from '../../../core/config/app.config.js';
import type { PostService } from '../../../modules/post/post.service.js';
import { GrammarAnnotatePagesCommand } from './grammar-annotate-pages.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');
const WEB_RUNNING_RE = /web app running/;
const NO_PAGES_RE = /listed no grammar pages/;
const LISTS = { literal: ['on the other hand'], phrasalVerbs: ['give up'] };
const PHRASE_ENTRY = {
  definition: 'Used to give the opposite point.',
  example: 'It is cheap. On the other hand, it is slow.',
  cefrLevel: 'B1',
  uk: { translation: 'з іншого боку' },
};

describe('GrammarAnnotatePagesCommand', () => {
  let annotateGrammarPage: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let command: GrammarAnnotatePagesCommand;

  beforeEach(() => {
    annotateGrammarPage = vi
      .fn()
      .mockResolvedValue({ blocks: 1, parsed: 1, removed: 0 });
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: { 'modality-can': ['She can swim.'], 'modality-may': [] },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        'on the other hand': PHRASE_ENTRY,
        'give up': { ...PHRASE_ENTRY, type: 'phrasal_verb' },
      }),
    );
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    command = injectOrm(
      new GrammarAnnotatePagesCommand(
        { annotateGrammarPage } as unknown as PostService,
        { publicUrl: 'http://web.test' } as ConfigType<typeof AppConfig>,
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('annotates every page the web app lists, from PUBLIC_URL by default', async () => {
    await command.run([], {});

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://web.test/grammar/lex-blocks.json',
    );
    expect(annotateGrammarPage.mock.calls).toEqual([
      ['modality-can', ['She can swim.'], LISTS, false],
      ['modality-may', [], LISTS, false],
    ]);
  });

  it('uses --web-url when given', async () => {
    await command.run([], { webUrl: 'http://localhost:4321' });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://localhost:4321/grammar/lex-blocks.json',
    );
  });

  it('passes --refresh through', async () => {
    await command.run([], { refresh: true });

    expect(annotateGrammarPage.mock.calls[0]?.[3]).toBe(true);
  });

  it('fails when the web app lists no pages', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pages: {} })));

    await expect(command.run([], {})).rejects.toThrow(NO_PAGES_RE);
    expect(annotateGrammarPage).not.toHaveBeenCalled();
  });

  it('fails when the web app does not answer', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));

    await expect(command.run([], {})).rejects.toThrow(WEB_RUNNING_RE);
    expect(annotateGrammarPage).not.toHaveBeenCalled();
  });
});
