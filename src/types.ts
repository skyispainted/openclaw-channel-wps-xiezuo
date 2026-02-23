/**
 * WPS协作账号配置
 */
export type SimpleXiezuoAccountConfig = {
  // 基本配置
  name?: string;
  enabled?: boolean;

  // WPS协作应用配置
  appId?: string;
  secretKey?: string;
  encryptKey?: string;
  apiUrl?: string;

  // 企业信息
  companyId?: string;

  // 访问控制策略
  dmPolicy?: "open" | "allowlist";
  groupPolicy?: "open" | "allowlist";
  allowFrom?: string[];

  // 消息处理选项
  showThinking?: boolean;
  requireMention?: boolean;
  groupSystemPrompt?: string;

  // 调试选项
  debug?: boolean;
};

/**
 * WPS协作完整配置（支持多账号）
 */
export type SimpleXiezuoConfig = SimpleXiezuoAccountConfig & {
  accounts?: Record<string, SimpleXiezuoAccountConfig | undefined>;
};

// 向后兼容类型别名
export type WpsXiezuoChannelConfig = SimpleXiezuoConfig;
export type WpsXiezuoAccountConfig = SimpleXiezuoAccountConfig;
