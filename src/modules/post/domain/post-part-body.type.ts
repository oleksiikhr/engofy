import { JsonType } from '@mikro-orm/core';

// A PostPart body is a single Paragraph or ListBlock fragment (never a whole
// Doc — there is no `Post.body` column). This type does NOT run `parseDoc` on
// read: which block parser applies depends on the sibling `kind` column, which
// a MikroORM custom type's convertToJSValue can't see. Full structural
// validation happens once the fragments are reassembled — see
// `get-post-detail.handler.ts` (`parseDoc(assembleDocFromParts(...))`).
export class PostPartBodyType extends JsonType {
  override getColumnType(): string {
    return 'jsonb';
  }
}
