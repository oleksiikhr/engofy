import { Module } from '@nestjs/common';
import { ContentModule } from '../../../modules/content/content.module.js';
import { AnnotateContentProcessor } from './annotate-content.processor.js';

@Module({
  imports: [ContentModule],
  providers: [AnnotateContentProcessor],
})
export class AnnotateContentModule {}
