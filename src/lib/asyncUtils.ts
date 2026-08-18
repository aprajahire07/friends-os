/**
 * FRIEND OS — Async Utilities & Stability Guard
 * Provides timeout protection, debouncing, and in-flight request deduplication.
 */

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps any promise with a maximum timeout.
 * If the promise exceeds timeoutMs, it resolves to fallbackValue (or rejects if no fallback provided).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 10000,
  fallbackValue?: T
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw err;
  }
}

/**
 * Debounces function executions.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs = 150
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, waitMs);
  };
}

/**
 * Prevents multiple simultaneous executions of the same async task.
 * If a task for 'key' is already in-flight, returns the existing Promise.
 */
const inFlightPromises = new Map<string, Promise<any>>();

export function dedupeAsync<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = inFlightPromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = task()
    .finally(() => {
      inFlightPromises.delete(key);
    });

  inFlightPromises.set(key, promise);
  return promise;
}
