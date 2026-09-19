import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AccountDeletionService } from '../../services/account-deletion.service.js';
import type { AccountDeletionView } from '../../types/account-deletion-view.type.js';
import { GetAccountDeletionQuery } from './get-account-deletion.query.js';

@QueryHandler(GetAccountDeletionQuery)
export class GetAccountDeletionHandler
  implements IQueryHandler<GetAccountDeletionQuery>
{
  constructor(private readonly deletions: AccountDeletionService) {}

  async execute({
    userId,
  }: GetAccountDeletionQuery): Promise<AccountDeletionView | null> {
    const request = await this.deletions.findActive(userId);

    return request ? this.deletions.toView(request) : null;
  }
}
