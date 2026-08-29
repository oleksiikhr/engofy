import type { Platform, TransformContext } from '@mikro-orm/core';
import { JsonType } from '@mikro-orm/core';
import { parseDoc } from './node-tree.parser.js';
import type { Doc } from './node-tree.types.js';

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
