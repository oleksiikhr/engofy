import { Logger } from '@nestjs/common';

// Suppress NestJS logger output in unit tests — avoids noise in test runner output.
Logger.overrideLogger([]);
