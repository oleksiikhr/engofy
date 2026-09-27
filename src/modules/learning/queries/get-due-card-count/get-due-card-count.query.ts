import { Query } from '@nestjs/cqrs';
import type { CardTargetType } from '../../domain/card-target.js';

export class GetDueCardCountQuery extends Query<number> {
  constructor(
    readonly userId: string,
    readonly types?: readonly CardTargetType[],
  ) {
    super();
  }
}
