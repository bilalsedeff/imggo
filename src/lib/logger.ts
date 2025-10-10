/**
 * Structured logging utility for ImgGo
 * Provides consistent logging with context throughout the application
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  request_id?: string;
  user_id?: string;
  job_id?: string;
  pattern_id?: string;
  [key: string]: unknown;
}

interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: {
    message: string;
    stack?: string;
    cause?: unknown;
  };
}

class Logger {
  private context: LogContext = {};
  private minLevel: LogLevel;

  constructor(initialContext?: LogContext) {
    this.context = initialContext || {};
    this.minLevel = this.parseLogLevel(process.env.LOG_LEVEL || "info");
  }

  private parseLogLevel(level: string): LogLevel {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.includes(level as LogLevel) ? (level as LogLevel) : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  /**
   * Update context for this logger instance
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  private log(level: LogLevel, message: string, meta?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case "debug":
      case "info":
        console.log(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  debug(message: string, meta?: LogContext): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: LogContext): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.log("warn", message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: LogContext): void {
    const errorMeta: LogContext = { ...meta };

    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    } else if (error) {
      errorMeta.error = { message: String(error) };
    }

    this.log("error", message, errorMeta);
  }
}

// Default logger instance
export const logger = new Logger();

// Factory for creating loggers with context
export function createLogger(context?: LogContext): Logger {
  return new Logger(context);
}
