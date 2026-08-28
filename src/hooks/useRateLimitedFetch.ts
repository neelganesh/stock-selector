import { useState, useCallback, useEffect, useRef } from 'react';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface UseRateLimitedFetchOptions {
  rateLimit?: RateLimitConfig;
  initialData?: unknown;
  enabled?: boolean;
}

interface FetchState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastFetch: Date | null;
  retryAfter: number | null;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60000, // 5 requests per minute for yfinance
};

export function useRateLimitedFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseRateLimitedFetchOptions = {}
) {
  const {
    rateLimit = DEFAULT_RATE_LIMIT,
    initialData = null,
    enabled = true,
  } = options;

  const [state, setState] = useState<FetchState<T>>({
    data: initialData as T,
    isLoading: false,
    error: null,
    lastFetch: null,
    retryAfter: null,
  });

  const requestTimestamps = useRef<number[]>([]);

  const getWaitTime = useCallback((): number => {
    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;

    // Clean old timestamps
    requestTimestamps.current = requestTimestamps.current.filter(ts => ts > windowStart);

    if (requestTimestamps.current.length < rateLimit.maxRequests) {
      return 0;
    }

    // Return wait time until oldest request exits the window
    const oldestInWindow = requestTimestamps.current[0];
    return oldestInWindow + rateLimit.windowMs - now;
  }, [rateLimit]);

  const execute = useCallback(async () => {
    const waitTime = getWaitTime();

    if (waitTime > 0) {
      setState(prev => ({ ...prev, retryAfter: waitTime }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, retryAfter: null }));
    requestTimestamps.current.push(Date.now());

    try {
      const data = await fetchFn();
      setState({
        data,
        isLoading: false,
        error: null,
        lastFetch: new Date(),
        retryAfter: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Fetch failed'),
        retryAfter: null,
      }));
    }
  }, [fetchFn, getWaitTime]);

  useEffect(() => {
    if (enabled) {
      execute();
    }
  }, [enabled, execute]);

  const refetch = useCallback(() => {
    const waitTime = getWaitTime();
    if (waitTime > 0) {
      setState(prev => ({ ...prev, retryAfter: waitTime }));
      return Promise.reject(new Error(`Rate limited. Retry after ${waitTime}ms`));
    }
    return execute();
  }, [execute, getWaitTime]);

  return {
    ...state,
    refetch,
    canFetch: getWaitTime() === 0,
  };
}
