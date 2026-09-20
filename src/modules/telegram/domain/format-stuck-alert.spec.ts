import { DateTime } from 'luxon';
import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../post/enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../post/enums/post-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';
import { formatStuckAlert } from './format-stuck-alert.js';

function view(
  overrides: Partial<PostPipelineStatusView> = {},
): PostPipelineStatusView {
  return {
    id: '0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
    shortId: 'abc123',
    title: 'My Post',
    status: PostStatus.Processing,
    createdAt: DateTime.now(),
    stages: [],
    ...overrides,
  };
}

describe('formatStuckAlert', () => {
  it('names the first unfinished stage, idle time, and status/retry lines', () => {
    const text = formatStuckAlert(
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
            status: PostPipelineRunStatus.Pending,
            retryCount: 2,
            errorMessage: 'timeout\nafter 30s',
          },
        ],
      }),
      23,
    );

    expect(text).toBe(
      [
        'Post stuck: My Post',
        'id: 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
        'idle: 23 min',
        'stage: ai_exercises (pending, retries: 2)',
        'error: timeout after 30s',
        'Status: /status 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
        'Re-run: /retry 0190aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
      ].join('\n'),
    );
  });

  it('falls back to the last stage when all completed, and to shortId without a title', () => {
    const text = formatStuckAlert(
      view({
        title: null,
        stages: [
          {
            stage: PostPipelineStage.Annotation,
            status: PostPipelineRunStatus.Completed,
            retryCount: 0,
            errorMessage: null,
          },
          {
            stage: PostPipelineStage.AiGrammar,
            status: PostPipelineRunStatus.Completed,
            retryCount: 0,
            errorMessage: null,
          },
        ],
      }),
      40,
    );

    expect(text.split('\n')[0]).toBe('Post stuck: abc123');
    expect(text).toContain('stage: ai_grammar (completed, retries: 0)');
    expect(text).not.toContain('error:');
  });

  it('omits the stage line when the post has no runs', () => {
    const text = formatStuckAlert(view(), 15);

    expect(text).not.toContain('stage:');
    expect(text).toContain('idle: 15 min');
  });
});
