let currentLogger: any = null;

/**
 * 设置当前日志器（用于共享服务模块）
 */
export function setCurrentLogger(logger: any): void {
  currentLogger = logger;
}

/**
 * 获取当前日志器
 */
export function getLogger(): any {
  return currentLogger;
}