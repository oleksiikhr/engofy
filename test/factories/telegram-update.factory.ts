import { Factory } from '@mikro-orm/seeder';
import { TelegramUpdate } from '../../src/modules/telegram/entities/telegram-update.entity.js';
import { nextSeq } from './sequence.js';

export class TelegramUpdateFactory extends Factory<TelegramUpdate> {
  readonly model = TelegramUpdate;

  protected definition() {
    return { updateId: String(nextSeq('telegram-update')), rawPayload: {} };
  }
}
