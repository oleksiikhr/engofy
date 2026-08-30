import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import type { PostService } from '../../../modules/post/post.service.js';
import { AnnotatePostProcessor } from './annotate-post.processor.js';
import { AssessComplexityProcessor } from './assess-complexity.processor.js';
import { GenerateExercisesProcessor } from './generate-exercises.processor.js';
import { PublishPostProcessor } from './publish-post.processor.js';
import { SpacyParsePostProcessor } from './spacy-parse-post.processor.js';
import { TagGrammarProcessor } from './tag-grammar.processor.js';

// Each pipeline processor is a thin `JobWorkerHost`: it names its stage +
// post via `pipelineStage()` (so the host can track `post_pipeline_runs`) and
// delegates `processJob()` to exactly one `PostService` method. `work()`
// itself is covered by `pipeline-run-tracking.ispec.ts`.
interface Exposed {
  pipelineStage(job: unknown): { stage: PostPipelineStage; postId: string };
  processJob(job: unknown): Promise<void>;
}

const CASES = [
  {
    name: 'SpacyParsePostProcessor',
    Processor: SpacyParsePostProcessor,
    stage: PostPipelineStage.SpacyParse,
    method: 'spacyParse',
  },
  {
    name: 'AnnotatePostProcessor',
    Processor: AnnotatePostProcessor,
    stage: PostPipelineStage.Annotation,
    method: 'annotate',
  },
  {
    name: 'AssessComplexityProcessor',
    Processor: AssessComplexityProcessor,
    stage: PostPipelineStage.AiComplexity,
    method: 'assessComplexity',
  },
  {
    name: 'TagGrammarProcessor',
    Processor: TagGrammarProcessor,
    stage: PostPipelineStage.AiGrammar,
    method: 'tagGrammar',
  },
  {
    name: 'GenerateExercisesProcessor',
    Processor: GenerateExercisesProcessor,
    stage: PostPipelineStage.AiExercises,
    method: 'generateExercises',
  },
  {
    name: 'PublishPostProcessor',
    Processor: PublishPostProcessor,
    stage: PostPipelineStage.Publish,
    method: 'publish',
  },
] as const;

describe('post pipeline processors', () => {
  it.each(CASES)(
    '$name -> stage $stage, delegates processJob to postService.$method',
    async ({ Processor, stage, method }) => {
      const call = vi.fn().mockResolvedValue(undefined);
      const postService = { [method]: call } as unknown as PostService;
      const processor = new Processor(postService) as unknown as Exposed;

      const job = { data: { postId: 'post-123' } };

      expect(processor.pipelineStage(job)).toEqual({
        stage,
        postId: 'post-123',
      });

      await processor.processJob(job);
      expect(call).toHaveBeenCalledWith('post-123');
    },
  );
});
