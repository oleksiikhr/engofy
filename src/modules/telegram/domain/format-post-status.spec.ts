import { DateTime } from 'luxon';
import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../post/enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../post/enums/post-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';
import { formatPostStatuses, formatQueuedReply } from './format-post-status.js';

const ID = '01920000-0000-7000-8000-000000000000';

function view(
  overrides: Partial<PostPipelineStatusView> = {},
): PostPipelineStatusView {
  return {
    id: ID,
    shortId: 'abc123',
    title: 'A tale',
    status: PostStatus.Processing,
    createdAt: DateTime.now(),
    stages: [],
    ...overrides,
  };
}

describe('formatQueuedReply', () => {
  it('carries the full post id with ready-to-paste /status and /retry lines', () => {
    expect(formatQueuedReply({ id: ID })).toBe(
      [
        `Queued. Post ${ID} is processing.`,
        `Progress: /status ${ID}`,
        `Re-run: /retry ${ID}`,
      ].join('\n'),
    );
  });
});

describe('formatPostStatuses', () => {
  it('returns the empty text when there are no posts', () => {
    expect(formatPostStatuses([], 'nothing here')).toBe('nothing here');
  });

  it('lists stages with marks, retries and the failure message, and offers /retry for a failed post', () => {
    const text = formatPostStatuses(
      [
        view({
          status: PostStatus.Failed,
          stages: [
            {
              stage: PostPipelineStage.SpacyParse,
              status: PostPipelineRunStatus.Completed,
              retryCount: 0,
              errorMessage: null,
            },
            {
              stage: PostPipelineStage.AiExercises,
              status: PostPipelineRunStatus.Failed,
              retryCount: 3,
              errorMessage: 'bad\npayload',
            },
          ],
        }),
      ],
      '',
    );

    expect(text).toBe(
      [
        'A tale — failed',
        `id: ${ID}`,
        '✓ spacy_parse',
        '✗ ai_exercises (retries: 3): bad payload',
        `Re-run: /retry ${ID}`,
      ].join('\n'),
    );
  });

  it('falls back to the short id without a title, notes a post with no stages, and truncates long errors', () => {
    const long = 'x'.repeat(300);
    const text = formatPostStatuses(
      [
        view({ title: null }),
        view({
          stages: [
            {
              stage: PostPipelineStage.Annotation,
              status: PostPipelineRunStatus.Failed,
              retryCount: 0,
              errorMessage: long,
            },
          ],
        }),
      ],
      '',
    );

    const [first, second] = text.split('\n\n');
    expect(first).toContain('abc123 — processing');
    expect(first).toContain('no stages have run yet');
    expect(second).toContain(`✗ annotation: ${'x'.repeat(200)}…`);
    expect(second).not.toContain('/retry');
  });
});
