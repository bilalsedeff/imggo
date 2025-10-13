/**
 * Circuit Breaker pattern implementation
 * Protects against cascading failures and enables graceful degradation
 * Used for provider failover (OpenAI → Gemini → Anthropic)
 */

import { logger } from "./logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening
  successThreshold?: number; // Number of successes in HALF_OPEN before closing
  timeout?: number; // Time in ms before attempting to close (transition to HALF_OPEN)
  monitoringPeriod?: number; // Time window for counting failures (ms)
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

interface FailureRecord {
  timestamp: number;
  error: Error;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;
  private failures: FailureRecord[] = [];

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly monitoringPeriod: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly onFailure?: (error: Error) => void;
  private readonly onSuccess?: () => void;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 60000; // 1 minute default
    this.monitoringPeriod = options.monitoringPeriod ?? 120000; // 2 minutes
    this.onStateChange = options.onStateChange;
    this.onFailure = options.onFailure;
    this.onSuccess = options.onSuccess;

    logger.info(`Circuit breaker initialized`, {
      name: this.name,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      timeout: this.timeout,
    });
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "OPEN") {
      // Check if timeout has passed
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`
        );
      }

      // Transition to HALF_OPEN
      this.transitionTo("HALF_OPEN");
    }

    try {
      // Execute the operation
      const result = await operation();

      // Record success
      this.recordSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));

      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(): void {
    this.onSuccess?.();

    if (this.state === "HALF_OPEN") {
      this.successCount++;

      logger.info(`Circuit breaker success in HALF_OPEN`, {
        name: this.name,
        successCount: this.successCount,
        successThreshold: this.successThreshold,
      });

      // Transition back to CLOSED after enough successes
      if (this.successCount >= this.successThreshold) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      // Clean up old failures
      this.cleanupOldFailures();
    }
  }

  /**
   * Record a failed execution
   */
  private recordFailure(error: Error): void {
    this.onFailure?.(error);

    const now = Date.now();
    this.failures.push({ timestamp: now, error });

    // Clean up old failures outside monitoring period
    this.cleanupOldFailures();

    // Count recent failures
    const recentFailures = this.failures.filter(
      (f) => now - f.timestamp < this.monitoringPeriod
    );
    this.failureCount = recentFailures.length;

    logger.warn(`Circuit breaker failure recorded`, {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      error: error.message,
    });

    // Transition based on state
    if (this.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN reopens the circuit
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      // Too many failures in CLOSED opens the circuit
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo("OPEN");
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;

    logger.info(`Circuit breaker state transition`, {
      name: this.name,
      from: oldState,
      to: newState,
    });

    // State-specific actions
    switch (newState) {
      case "OPEN":
        // Set next attempt time
        this.nextAttemptTime = Date.now() + this.timeout;
        this.successCount = 0;
        logger.warn(`Circuit breaker opened`, {
          name: this.name,
          nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
          recentFailures: this.failureCount,
        });
        break;

      case "HALF_OPEN":
        this.successCount = 0;
        logger.info(`Circuit breaker attempting recovery (HALF_OPEN)`, {
          name: this.name,
        });
        break;

      case "CLOSED":
        this.failureCount = 0;
        this.successCount = 0;
        this.failures = [];
        logger.info(`Circuit breaker closed (recovered)`, {
          name: this.name,
        });
        break;
    }

    // Call state change callback
    this.onStateChange?.(oldState, newState);
  }

  /**
   * Remove old failures outside monitoring period
   */
  private cleanupOldFailures(): void {
    const now = Date.now();
    this.failures = this.failures.filter(
      (f) => now - f.timestamp < this.monitoringPeriod
    );
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === "OPEN" && Date.now() < this.nextAttemptTime;
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    logger.info(`Circuit breaker manually reset`, {
      name: this.name,
      previousState: this.state,
    });

    this.failureCount = 0;
    this.successCount = 0;
    this.failures = [];
    this.nextAttemptTime = 0;
    this.state = "CLOSED";
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      isOpen: this.isOpen(),
      nextAttemptTime: this.state === "OPEN" ? this.nextAttemptTime : null,
    };
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get all breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get metrics for all breakers
   */
  getAllMetrics() {
    return Array.from(this.breakers.values()).map((b) => b.getMetrics());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
    logger.info(`All circuit breakers reset`, {
      count: this.breakers.size,
    });
  }
}

/**
 * Global registry instance
 */
export const circuitBreakers = new CircuitBreakerRegistry();
