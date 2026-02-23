/**
 * 安全工具函数
 */

/**
 * 掩码敏感数据（用于日志）
 */
export function maskSensitiveData(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      // 检查敏感字段名
      const sensitiveKeys = ["token", "secret", "password", "key", "signature", "access_token"];
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        result[key] = "***REDACTED***";
        continue;
      }
    }

    result[key] = maskSensitiveData(value);
  }

  return result;
}

/**
 * 随机延迟（用于重连抖动）
 */
export function getRandomDelay(baseDelay: number, jitter: number): number {
  const randomFactor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.max(100, baseDelay * randomFactor);
}

/**
 * 带指数退避的重试
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    jitter?: number;
    log?: any;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    jitter = 0.3,
    log,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );
        const jitteredDelay = getRandomDelay(delay, jitter);

        log?.debug?.(`[retryWithBackoff] Attempt ${attempt + 1} failed, retrying in ${jitteredDelay}ms: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
  }

  throw lastError!;
}