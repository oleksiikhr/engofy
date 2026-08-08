import type {
  AnyString,
  LogContext,
  Logger,
  LoggerNamespace,
  LoggerOptions,
} from '@mikro-orm/core';
import { Logger as NestLogger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

export class MikroOrmLogger implements Logger {
  private readonly logger = new NestLogger(MikroOrmLogger.name);

  private readonly ignoreDeprecations?: boolean | string[];

  private debugMode: boolean | LoggerNamespace[];

  constructor(
    private readonly slowQueryThreshold: number,
    options?: Partial<LoggerOptions>,
  ) {
    this.ignoreDeprecations = options?.ignoreDeprecations;
    this.debugMode = options?.debugMode ?? false;
  }

  log(
    namespace: LoggerNamespace | AnyString,
    message: string,
    context?: LogContext,
  ): void {
    if (!this.isEnabled(namespace, context)) {
      return;
    }

    this.logger.log(this.buildMeta(namespace, context), message);
  }

  warn(
    namespace: LoggerNamespace | AnyString,
    message: string,
    context?: LogContext,
  ): void {
    if (!this.isEnabled(namespace, context)) {
      return;
    }

    this.logger.warn(this.buildMeta(namespace, context), message);
  }

  error(
    namespace: LoggerNamespace | AnyString,
    message: string,
    context?: LogContext,
  ): void {
    this.logger.error(this.buildMeta(namespace, context), message);
  }

  logQuery(context: LogContext): void {
    Sentry.addBreadcrumb({
      category: 'db.query',
      type: 'query',
      level: 'info',
      message: context.query,
      data: {
        executionTimeMs: context?.took,
        affected: context.affected,
        results: context.results,
      },
    });

    if (!this.isEnabled('query', context) || !context.query) {
      return;
    }

    if (context.took && context.took > this.slowQueryThreshold) {
      this.logger.warn(
        {
          ...this.buildMeta('query', context),
          sql: context.query,
          affected: context.affected,
          results: context.results,
        },
        'Slow database query',
      );
    }
  }

  setDebugMode(debugMode: boolean | LoggerNamespace[]): void {
    this.debugMode = debugMode;
  }

  isEnabled(
    namespace: LoggerNamespace | AnyString,
    context?: LogContext,
  ): boolean {
    if (context?.enabled !== undefined) {
      return context.enabled;
    }

    const debugMode = context?.debugMode ?? this.debugMode;

    if (namespace === 'deprecated') {
      if (Array.isArray(this.ignoreDeprecations)) {
        return !this.ignoreDeprecations.includes(context?.label ?? '');
      }

      return !this.ignoreDeprecations;
    }

    if (!debugMode) {
      return false;
    }

    if (debugMode === true) {
      return true;
    }

    return debugMode.includes(namespace as LoggerNamespace);
  }

  private buildMeta(
    namespace: LoggerNamespace | AnyString,
    context?: LogContext,
  ): Record<string, unknown> {
    return {
      namespace,
      label: context?.label,
      took_ms: context?.took,
    };
  }
}
