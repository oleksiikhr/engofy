import { registerAs } from '@nestjs/config';
import {
  envNumber,
  envRequiredString,
  envString,
} from '../helpers/env.helper.js';

export default registerAs('s3', () => ({
  endpoint: envString('S3_ENDPOINT'),
  bucket: envRequiredString('S3_BUCKET'),
  region: envRequiredString('S3_REGION'),
  accessKey: envString('S3_ACCESS_KEY'),
  secretKey: envString('S3_SECRET_KEY'),
  corsMaxAge: envNumber('S3_CORS_MAX_AGE', 3000),
}));
