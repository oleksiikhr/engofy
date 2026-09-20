import { Factory } from '@mikro-orm/seeder';
import { UserSkillProgress } from '../../src/modules/learning/entities/user-skill-progress.entity.js';

// `userId` and `constructionId` have no default — pass the parents' ids.
export class UserSkillProgressFactory extends Factory<UserSkillProgress> {
  readonly model = UserSkillProgress;

  protected definition() {
    return {};
  }
}
