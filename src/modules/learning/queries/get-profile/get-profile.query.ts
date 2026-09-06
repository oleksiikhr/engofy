import { Query } from '@nestjs/cqrs';
import type { ProfileView } from './profile-view.js';

export class GetProfileQuery extends Query<ProfileView> {
  constructor(readonly userId: string) {
    super();
  }
}
