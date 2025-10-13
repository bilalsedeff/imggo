/**
 * Retry utility with exponential backoff and jitter
 * Used for resilient API calls to external services (LLM providers, etc.)
 */

import { logger } from "./logger";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Default retry strategy: exponential backoff with jitter
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2, // doubles each time
  jitterFactor: 0.3, // ±30% randomness
  onRetry: () => {}, // no-op
  shouldRetry: () => true, // retry all errors by default
};

/**
 * Sleep utility
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: random value between (1 - jitterFactor) and (1 + jitterFactor)
  const jitterMin = 1 - jitterFactor;
  const jitterMax = 1 + jitterFactor;
  const jitter = jitterMin + Math.random() * (jitterMax - jitterMin);

  return Math.floor(cappedDelay * jitter);
}

/**
 * Retry an async operation with exponential backoff and jitter
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      // Execute the operation
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        logger.warn("Error not retryable, failing immediately", {
          error: lastError.message,
          attempt: attempt + 1,
        });
        throw lastError;
      }

      // Last attempt reached
      if (attempt >= opts.maxAttempts - 1) {
        logger.error("Max retry attempts reached", {
          error: lastError.message,
          attempts: opts.maxAttempts,
        });
        throw lastError;
      }

      // Calculate delay before next retry
      const delay = calculateDelay(
        attempt,
        opts.baseDelayMs,
        opts.backoffMultiplier,
        opts.maxDelayMs,
        opts.jitterFactor
      );

      logger.info("Retrying operation after delay", {
        attempt: attempt + 1,
        maxAttempts: opts.maxAttempts,
        delayMs: delay,
        error: lastError.message,
      });

      // Call onRetry callback
      opts.onRetry(attempt + 1, lastError);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("Retry failed without error");
}

/**
 * Retry with result pattern (doesn't throw, returns result object)
 */
export async function retryWithResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  try {
    const data = await retryWithBackoff(operation, options);
    return {
      success: true,
      data,
      attempts: 1, // Simplified - would need to track actual attempts
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: options.maxAttempts || DEFAULT_OPTIONS.maxAttempts,
    };
  }
}

/**
 * Predefined retry strategies
 */
export const RetryStrategies = {
  /**
   * For HTTP API calls (OpenAI, Anthropic, etc.)
   * Retries 5xx and 429 (rate limit) errors
   */
  httpApi: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
    shouldRetry: (error: Error): boolean => {
      const message = error.message.toLowerCase();
      // Retry on network errors, 5xx, and 429 (rate limit)
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("econnreset") ||
        message.includes("429") ||
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504")
      );
    },
  } as RetryOptions,

  /**
   * For database operations
   * Quick retries for transient DB errors
   */
  database: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    shouldRetry: (error: Error): boolean => {
      const message = error.message.toLowerCase();
      return (
        message.includes("connection") ||
        message.includes("timeout") ||
        message.includes("deadlock")
      );
    },
  } as RetryOptions,

  /**
   * For external webhooks
   * Aggressive retry for webhook delivery
   */
  webhook: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 3,
    jitterFactor: 0.4,
    shouldRetry: (error: Error): boolean => {
      const message = error.message.toLowerCase();
      // Don't retry 4xx client errors except 429
      if (
        message.includes("400") ||
        message.includes("401") ||
        message.includes("403") ||
        message.includes("404")
      ) {
        return false;
      }
      return true;
    },
  } as RetryOptions,

  /**
   * For critical operations that must succeed
   * Very patient retry strategy
   */
  critical: {
    maxAttempts: 10,
    baseDelayMs: 1000,
    maxDelayMs: 120000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.5,
    shouldRetry: (): boolean => true,
  } as RetryOptions,
};

/**
 * Utility to check if error is retryable based on HTTP status
 */
export function isRetryableHttpError(statusCode: number): boolean {
  // Retry server errors (5xx) and rate limits (429)
  if (statusCode >= 500 || statusCode === 429) {
    return true;
  }
  // Don't retry client errors (4xx)
  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }
  // Retry network errors (no status code)
  return true;
}

/**
 * Extract HTTP status code from error message
 */
export function extractStatusCode(error: Error): number | null {
  const match = error.message.match(/\b([45]\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}
