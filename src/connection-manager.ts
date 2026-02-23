/**
 * 连接管理器
 *
 * 用于管理HTTP回调服务器的状态和重连策略
 */

export type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export interface ConnectionManagerConfig {
  // 连接超时（毫秒）
  timeout?: number;
  // 心跳间隔（毫秒）
  heartbeatInterval?: number;
  // 是否启用日志
  debug?: boolean;
  // 状态变化回调
  onStateChange?: (state: ConnectionState, error?: string) => void;
}

export class ConnectionManager {
  private state: ConnectionState = "disconnected";
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private config: ConnectionManagerConfig;
  private log: any;

  constructor(config: ConnectionManagerConfig = {}, log?: any) {
    this.config = {
      timeout: config.timeout ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 60000,
      debug: config.debug ?? false,
      onStateChange: config.onStateChange,
    };
    this.log = log;
  }

  /**
   * 连接（对于HTTP回调模式，主要是初始化服务器）
   */
  async connect(): Promise<void> {
    this.setState("connecting");

    try {
      // HTTP回调模式下，连接操作主要是标记状态
      // 实际连接由OpenClaw的HTTP服务器处理
      this.setState("connected");

      // 启动心跳
      this.startHeartbeat();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setState("failed", message);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  stop(): void {
    this.stopHeartbeat();
    this.setState("disconnected");
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === "connected";
  }

  /**
   * 等待停止
   */
  async waitForStop(): Promise<void> {
    // HTTP回调模式下，不需要等待
    // 连接由OpenClaw管理
  }

  /**
   * 获取当前状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 设置状态
   */
  private setState(state: ConnectionState, error?: string): void {
    if (this.state === state) {
      return;
    }

    this.state = state;
    this.config.onStateChange?.(state, error);

    if (this.config.debug) {
      this.log?.debug?.(`[ConnectionManager] State changed to: ${state}${error ? ` (${error})` : ""}`);
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer || !this.config.heartbeatInterval) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.config.debug) {
        this.log?.debug?.("[ConnectionManager] Heartbeat");
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopHeartbeat();
  }
}