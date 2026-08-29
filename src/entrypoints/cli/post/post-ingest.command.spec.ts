import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { PostSourceFormat } from '../../../modules/post/enums/post-source-format.enum.js';
import { PostIngestCommand } from './post-ingest.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');

describe('PostIngestCommand', () => {
  let command: PostIngestCommand;
  let ingest: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ingest = vi.fn();
    command = injectOrm(new PostIngestCommand({ ingest } as never), {
      em: {},
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseTitle passes the raw option value through', () => {
    expect(command.parseTitle('My Title')).toBe('My Title');
  });

  it('reads the given file and ingests it', async () => {
    vi.mocked(readFile).mockResolvedValue('raw file contents');
    ingest.mockResolvedValue({
      id: 'post-id',
      source: { format: PostSourceFormat.Text },
    });

    await command.run(['./some/file.txt'], { title: 'A title' });

    expect(readFile).toHaveBeenCalledWith('./some/file.txt', 'utf-8');
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: 'raw file contents',
        title: 'A title',
      }),
    );
  });

  it('logs the ingested post id and format', async () => {
    vi.mocked(readFile).mockResolvedValue('raw file contents');
    ingest.mockResolvedValue({
      id: 'post-id',
      source: { format: PostSourceFormat.Markdown },
    });

    await command.run(['./some/file.md'], {});

    expect(logSpy).toHaveBeenCalledWith(
      { id: 'post-id', format: PostSourceFormat.Markdown },
      'post ingested',
    );
  });
});
