import { Migration } from '@mikro-orm/migrations';

export class Migration20260816133251 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "auth_challenges" ("id" uuid not null, "email" text not null, "otp_hash" text not null, "attempts" smallint not null default 0, "expires_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "auth_challenges" add constraint "auth_challenges_email_unique" unique ("email");`,
    );

    this.addSql(
      `create table "auth_sessions" ("id" uuid not null, "token_hash" text not null, "user_id" uuid not null, "expires_at" timestamp with time zone not null, "created_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "auth_sessions" add constraint "auth_sessions_token_hash_unique" unique ("token_hash");`,
    );

    this.addSql(
      `create table "users" ("id" uuid not null, "email" text not null, "google_sub" text null, "created_at" timestamp with time zone not null, "updated_at" timestamp with time zone not null, primary key ("id"));`,
    );
    this.addSql(
      `alter table "users" add constraint "users_email_unique" unique ("email");`,
    );
    this.addSql(
      `alter table "users" add constraint "users_google_sub_unique" unique ("google_sub");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "auth_challenges" cascade;`);
    this.addSql(`drop table if exists "auth_sessions" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
