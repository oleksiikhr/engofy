import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  DocumentBuilder,
  getSchemaPath,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type SwaggerConfig from '../../core/config/swagger.config.js';
import { ValidationErrorResponseDto } from '../../core/validation/validation-error-response.dto.js';

export async function buildOpenApiDocument(
  app: INestApplication,
  swaggerConfig: ConfigType<typeof SwaggerConfig>,
): Promise<OpenAPIObject> {
  const swaggerDocument = new DocumentBuilder()
    .addBearerAuth()
    .addGlobalResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
    })
    .addGlobalResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            oneOf: [
              { $ref: getSchemaPath(ValidationErrorResponseDto) },
              {
                type: 'object',
                properties: { message: { type: 'string' } },
                required: ['message'],
              },
            ],
            discriminator: {
              propertyName: 'type',
              mapping: {
                validation: getSchemaPath(ValidationErrorResponseDto),
              },
            },
          },
        },
      },
    })
    .addGlobalResponse({
      status: HttpStatus.TOO_MANY_REQUESTS,
      description: 'Too many requests',
    })
    .setTitle(swaggerConfig.title)
    .setVersion(swaggerConfig.version)
    .build();

  const { default: metadata } = await import('../../metadata.js');
  await SwaggerModule.loadPluginMetadata(metadata);

  return SwaggerModule.createDocument(app, swaggerDocument, {
    extraModels: [ValidationErrorResponseDto],
  });
}
