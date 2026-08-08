import { Module } from '@nestjs/common';
import { ExampleProcessor } from './example.processor.js';

@Module({
  providers: [ExampleProcessor],
})
export class ExampleQueueModule {}
