import { JsonType } from '@mikro-orm/core';

// Unlike NodeTreeType (Post.body), this does not validate shape on read via
// parseDoc — a PostPart body is a Paragraph or ListItem fragment, and which
// parser applies depends on the sibling `kind` column, which isn't visible to
// a MikroORM custom type's convertToJSValue. Full structural validation
// happens where a Doc gets reassembled from parts (parseDoc(assembleDocFromParts(...))).
export class PostPartBodyType extends JsonType {
  override getColumnType(): string {
    return 'jsonb';
  }
}
