import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { ConfigType } from '@nestjs/config';
import type S3Config from './s3.config.js';
import { S3Service } from './s3.service.js';

describe('S3Service', () => {
  const config = { bucket: 'test-bucket' } as ConfigType<typeof S3Config>;
  let send: ReturnType<typeof vi.fn>;
  let service: S3Service;

  beforeEach(() => {
    send = vi.fn();
    service = new S3Service({ send } as unknown as S3Client, config);
  });

  describe('upload', () => {
    it('sends a PutObjectCommand with the given key, body and content type', async () => {
      send.mockResolvedValue({});

      await service.upload('avatars/1.png', Buffer.from('data'), 'image/png');

      expect(send).toHaveBeenCalledOnce();
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'avatars/1.png',
        Body: Buffer.from('data'),
        ContentType: 'image/png',
      });
    });
  });

  describe('getObject', () => {
    it('returns the object body and etag when found', async () => {
      const body = Readable.from(['data']);
      send.mockResolvedValue({ Body: body, ETag: '"abc123"' });

      const result = await service.getObject('avatars/1.png');

      expect(result).toEqual({ body, etag: '"abc123"' });
      const command = send.mock.calls[0][0] as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'avatars/1.png',
      });
    });

    it('defaults etag to an empty string when the response has none', async () => {
      send.mockResolvedValue({ Body: Readable.from(['data']) });

      const result = await service.getObject('avatars/1.png');

      expect(result?.etag).toBe('');
    });

    it('returns null when the object does not exist', async () => {
      send.mockRejectedValue(
        new NoSuchKey({ message: 'not found', $metadata: {} }),
      );

      await expect(service.getObject('missing.png')).resolves.toBeNull();
    });

    it('throws when the response has no body', async () => {
      send.mockResolvedValue({});

      await expect(service.getObject('avatars/1.png')).rejects.toThrow(
        'S3 object response has no body',
      );
    });

    it('rethrows errors other than NoSuchKey', async () => {
      send.mockRejectedValue(new Error('boom'));

      await expect(service.getObject('avatars/1.png')).rejects.toThrow('boom');
    });
  });
});
