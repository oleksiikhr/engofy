import { Query } from '@nestjs/cqrs';
import type { CardUsage } from '../../services/card-limit.service.js';

export class GetCardUsageQuery extends Query<CardUsage> {
  constructor(readonly userId: string) {
    super();
  }
}
