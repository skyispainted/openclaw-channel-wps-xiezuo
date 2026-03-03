import { z } from "zod";

/**
 * WPS协作账号配置
 */
export const SimpleXiezuoAccountConfigSchema = z.object({
  // 基本配置
  name: z.string().optional().describe("账号名称（可选显示名称）"),
  enabled: z.boolean().optional().default(true).describe("是否启用此账号"),

  // WPS协作应用配置
  appId: z.string().optional().describe("WPS应用ID (App ID)"),
  secretKey: z.string().optional().describe("WPS应用密钥 (Secret Key) - 用于API签名"),
  encryptKey: z.string().optional().describe("加密密钥 (Encrypt Key) - 用于回调验证和事件解密"),
  apiUrl: z.string().optional().default("https://openapi.wps.cn").describe("6. WPS API基础地址"),
  webhookPath: z.string().optional().default("/wps-xiezuo/webhook").describe("Webhook回调路径（可自定义，例如 /webhook/wps）"),

  // 企业信息
  companyId: z.string().optional().describe("企业ID - 发送单聊消息时需要"),

  // 访问控制策略
  dmPolicy: z.enum(["open", "allowlist"]).optional().default("open").describe("私聊策略：open-开放 / allowlist-白名单"),
  groupPolicy: z.enum(["open", "allowlist"]).optional().default("open").describe("群聊策略：open-开放 / allowlist-白名单"),
  allowFrom: z.array(z.string()).optional().describe("允许的用户/群聊ID列表（白名单模式使用）"),

  // 消息处理选项
  showThinking: z.boolean().optional().default(true).describe("是否显示\"思考中\"提示"),
  requireMention: z.boolean().optional().default(true).describe("群聊是否需要@机器人才响应"),
  groupSystemPrompt: z.string().optional().describe("群聊系统提示词"),

  // 调试选项
  debug: z.boolean().optional().default(false).describe("启用调试日志"),
});

/**
 * WPS协作完整配置（支持多账号）
 */
export const SimpleXiezuoConfigSchema = SimpleXiezuoAccountConfigSchema.extend({
  accounts: z.record(z.string(), SimpleXiezuoAccountConfigSchema.optional()).optional().describe("多账号配置"),
});

export type SimpleXiezuoAccountConfig = z.infer<typeof SimpleXiezuoAccountConfigSchema>;
export type SimpleXiezuoConfig = z.infer<typeof SimpleXiezuoConfigSchema>;
