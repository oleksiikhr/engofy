import { DateTime } from 'luxon';
import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../post/enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../post/enums/post-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';
import { formatFailureAlert } from './format-failure-alert.js';

function view(
  overrides: Partial<PostPipelineStatusView> = {},
): PostPipelineStatusView {
  return {
    id: '0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
    shortId: 'abc123',
    title: 'My Post',
    status: PostStatus.Failed,
    createdAt: DateTime.now(),
    stages: [],
    ...overrides,
  };
}

describe('formatFailureAlert', () => {
  it('names the failed stage, error and gives status/retry lines with the full id', () => {
    const text = formatFailureAlert(
      view({
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
            errorMessage: 'invalid   payload\nfor tool',
          },
        ],
      }),
    );

    expect(text).toBe(
      [
        'Post failed: My Post',
        'id: 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
        'stage: ai_exercises (retries: 3)',
        'error: invalid payload for tool',
        'Status: /status 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
        'Re-run: /retry 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
      ].join('\n'),
    );
  });

  it('truncates a long error and falls back to shortId without a title', () => {
    const text = formatFailureAlert(
      view({
        title: null,
        stages: [
          {
            stage: PostPipelineStage.Annotation,
            status: PostPipelineRunStatus.Failed,
            retryCount: 1,
            errorMessage: 'x'.repeat(400),
          },
        ],
      }),
    );

    expect(text.split('\n')[0]).toBe('Post failed: abc123');
    expect(text).toContain(`error: ${'x'.repeat(300)}…`);
  });

  it('still produces retry lines when no stage row is failed', () => {
    const text = formatFailureAlert(view());

    expect(text).not.toContain('stage:');
    expect(text).toContain(
      'Re-run: /retry 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
    );
  });
});
