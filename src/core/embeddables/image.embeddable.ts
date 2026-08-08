import { Embeddable, Property } from '@mikro-orm/decorators/legacy';

@Embeddable()
export class Image {
  @Property({ type: 'text' })
  hash!: string;

  @Property()
  width!: number;

  @Property()
  height!: number;

  @Property({ type: 'text' })
  ext!: string;

  @Property()
  fileSize!: number;

  buildKey(prefix: string): string {
    return `${prefix}${this.hash}.${this.ext}`;
  }

  static create(params: {
    hash: string;
    width: number;
    height: number;
    ext: string;
    fileSize: number;
  }): Image {
    const img = new Image();
    img.hash = params.hash;
    img.width = params.width;
    img.height = params.height;
    img.ext = params.ext;
    img.fileSize = params.fileSize;
    return img;
  }
}
