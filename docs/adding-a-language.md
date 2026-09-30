# Adding a native language

1. Add the member to `ContentLanguage` (`src/modules/post/enums/content-language.enum.ts`). The
   value is the code stored in `users.native_lang`, the `native-lang` cookie and every
   `translations` key.
2. Add its entry to `CONTENT_LANGUAGE_INFO` (`src/modules/post/domain/content-translations.ts`):
   `name` and `wordExample` feed the enrichment prompts.
3. Add it to `ENRICHMENT_LANGUAGES` in the same file so `enrichment` and `grammar_enrichment` write it
   for new posts.
4. Add its label to `NATIVE_LANG_LABEL` in `apps/web` (the switcher text on the profile page and the
   guest picker).
5. Add `translations.<code>` to the entries in `assets/*.json` (format: `assets/README.md`) and
   re-run `make seed`. Entries without it stay untranslated in that language until step 6.
6. Fill the rest for existing posts: `pnpm cli post backfill-translations --lang <code>` (real AI
   calls; only rows missing the language are sent).
