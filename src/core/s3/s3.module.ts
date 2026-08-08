import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import S3Config from './s3.config.js';
import { S3Service } from './s3.service.js';
import { S3_CLIENT } from './s3.tokens.js';

const configModule = ConfigModule.forFeature(S3Config);

@Module({
  imports: [configModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [S3Config.KEY],
      useFactory: (config: ConfigType<typeof S3Config>) =>
        new S3Client({
          region: config.region,
          ...(config.endpoint && { endpoint: config.endpoint }),
          ...(config.accessKey &&
            config.secretKey && {
              credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
              },
            }),
          forcePathStyle: !!config.endpoint,
        }),
    },
    S3Service,
  ],
  exports: [S3_CLIENT, S3Service, configModule],
})
export class S3Module {}
