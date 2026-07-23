

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: any;
}

class StructuredLogger {
  private environment: string;
  private lastMessage: string | null = null;
  private duplicateCount = 0;

  constructor() {
    this.environment = import.meta.env.MODE || 'production';
  }

  // Cryptographically safe correlation ID generator
  public generateCorrelationId(): string {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (e) {}
    }
    // Fallback pseudo-UUID
    return 'xxxx-xxxx-4xxx-yxxx-xxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.environment === 'development') {
      return true; // Log everything in dev
    }
    // In production, only log WARN and ERROR
    return level === 'WARN' || level === 'ERROR';
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const correlationId = context?.correlationId || this.generateCorrelationId();
    const timestamp = new Date().toISOString();

    return {
      timestamp,
      level,
      message,
      environment: this.environment,
      context: {
        correlationId,
        ...context
      }
    };
  }

  private print(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    // Deduplicate identical consecutive messages
    if (this.lastMessage === message) {
      this.duplicateCount++;
      if (this.duplicateCount > 3) {
        return; // Suppress excessive logs
      }
    } else {
      if (this.duplicateCount > 3) {
        console.warn(`[Logger] Suppressed ${this.duplicateCount - 3} duplicate logs for: "${this.lastMessage}"`);
      }
      this.lastMessage = message;
      this.duplicateCount = 0;
    }

    const payload = this.formatLog(level, message, context);
    const consoleMsg = `[${payload.level}] [${payload.timestamp}] [CorrID: ${payload.context.correlationId}] ${payload.message}`;

    switch (level) {
      case 'DEBUG':
        console.debug(consoleMsg, payload.context);
        break;
      case 'INFO':
        console.info(consoleMsg, payload.context);
        break;
      case 'WARN':
        console.warn(consoleMsg, payload.context);
        break;
      case 'ERROR':
        console.error(consoleMsg, payload.context);
        break;
    }
  }

  public debug(message: string, context?: LogContext) {
    this.print('DEBUG', message, context);
  }

  public info(message: string, context?: LogContext) {
    this.print('INFO', message, context);
  }

  public warn(message: string, context?: LogContext) {
    this.print('WARN', message, context);
  }

  public error(message: string, context?: LogContext) {
    this.print('ERROR', message, context);
  }
}

export const Logger = new StructuredLogger();
