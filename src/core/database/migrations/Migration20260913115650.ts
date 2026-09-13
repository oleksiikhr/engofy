import { Migration } from '@mikro-orm/migrations';

// learning-foundation slice 2: `learning_dispositions` (known/skipped calls on
// a target with no active card, same exactly-one-target CHECK pattern as
// `learning_cards`) and `learning_cards.archived_at` (RemoveCardHandler).
export class Migration20260913115650 extends Migration {
  override name = 'Migration20260913115650';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "learning_dispositions" ("id" uuid not null, "user_id" uuid not null, "word_definition_id" uuid null, "phrase_id" uuid null, "grammar_usage_point_id" uuid null, "disposition" text not null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_grammar_usage_point_id_unique" unique ("user_id", "grammar_usage_point_id");`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_phrase_id_unique" unique ("user_id", "phrase_id");`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_user_id_word_definition_id_unique" unique ("user_id", "word_definition_id");`,
    );

    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_exactly_one_target" check ((word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1);`,
    );
    this.addSql(
      `alter table "learning_dispositions" add constraint "learning_dispositions_disposition_check" check ("disposition" in ('known', 'skipped'));`,
    );

    this.addSql(
      `alter table "learning_cards" add "archived_at" timestamp with time zone null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "learning_dispositions" cascade;`);

    this.addSql(`alter table "learning_cards" drop column "archived_at";`);
  }
}
