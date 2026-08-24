import type { Readable } from 'node:stream';
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import S3Config from './s3.config.js';
import { S3_CLIENT } from './s3.tokens.js';

@Injectable()
export class S3Service {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(S3Config.KEY) private readonly config: ConfigType<typeof S3Config>,
  ) {}

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async getObject(
    key: string,
  ): Promise<{ body: Readable; etag: string } | null> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );

      if (!response.Body) {
        throw new Error('S3 object response has no body', { cause: { key } });
      }

      return { body: response.Body as Readable, etag: response.ETag ?? '' };
    } catch (err) {
      if (err instanceof NoSuchKey) {
        return null;
      }

      throw err;
    }
  }
}
