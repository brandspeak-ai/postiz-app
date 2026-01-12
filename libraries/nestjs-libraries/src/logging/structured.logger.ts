import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Structured JSON logger that replaces the default NestJS logger.
 * Outputs JSON in production, pretty format in development.
 */
export class StructuredLogger extends ConsoleLogger {
  private isProduction = process.env.NODE_ENV === 'production';
  private serviceName = process.env.SERVICE_NAME || 'postiz';

  protected formatMessage(
    level: string,
    message: any,
    context?: string,
    trace?: string
  ): string {
    const timestamp = new Date().toISOString();

    if (this.isProduction) {
      // JSON format for production (easy to parse by log aggregators)
      const logObject: Record<string, any> = {
        timestamp,
        level,
        service: this.serviceName,
        context: context || this.context,
        message: typeof message === 'object' ? message : String(message),
      };

      if (trace) {
        logObject.trace = trace;
      }

      return JSON.stringify(logObject);
    }

    // Pretty format for development
    const ctx = context || this.context || 'Application';
    const levelPadded = level.toUpperCase().padEnd(5);
    const prefix = `[${timestamp}] ${levelPadded} [${ctx}]`;

    if (typeof message === 'object') {
      return `${prefix} ${JSON.stringify(message, null, 2)}`;
    }

    return `${prefix} ${message}${trace ? `\n${trace}` : ''}`;
  }

  log(message: any, context?: string): void {
    console.log(this.formatMessage('info', message, context));
  }

  error(message: any, trace?: string, context?: string): void {
    console.error(this.formatMessage('error', message, context, trace));
  }

  warn(message: any, context?: string): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug(message: any, context?: string): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose(message: any, context?: string): void {
    if (process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug') {
      console.log(this.formatMessage('verbose', message, context));
    }
  }
}
