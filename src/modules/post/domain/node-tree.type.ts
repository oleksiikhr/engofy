import type { Platform, TransformContext } from '@mikro-orm/core';
import { JsonType } from '@mikro-orm/core';
import { parseDoc } from './node-tree.parser.js';
import type { Doc } from './node-tree.types.js';

// MikroORM custom type for a column that stores a whole Doc node tree and
// should be `parseDoc`-validated on every read. Nothing maps to it today — the
// tree is stored per-block via `PostPartBodyType` and validated on reassembly
// in `get-post-detail.handler.ts` — but it's the drop-in for a future
// denormalised `Post`-level tree column (PLAN.md §6).
export class NodeTreeType extends JsonType {
  override convertToJSValue(
    value: unknown,
    platform: Platform,
    context?: TransformContext,
  ): Doc {
    return parseDoc(super.convertToJSValue(value, platform, context));
  }

  override getColumnType(): string {
    return 'jsonb';
  }
}
