import { WPSClient } from "./wps-api.js";
import { ensureConfigComplete } from "./auto-config.js";

/**
 * 发送消息的参数
 */
export interface SendMessageOptions {
  log?: any;
}

/**
 * 发送消息到指定聊天
 *
 * @param config 配置对象（包含 appId, secretKey, apiUrl 等）
 * @param to 目标聊天ID（可以是用户ID或群聊ID）
 * @param text 消息文本内容
 * @param options 可选参数（包含日志记录器等）
 * @returns 消息发送结果
 */
export async function sendMessage(
  config: any,
  to: string,
  text: string,
  options?: SendMessageOptions
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    // 确保配置完整，特别是companyId
    const completeConfig = await ensureConfigComplete(config);

    const client = new WPSClient(
      completeConfig.appId,
      completeConfig.secretKey,
      completeConfig.apiUrl || "https://openapi.wps.cn"
    );

    // 简单发送文本消息
    const result = await client.sendTextMessage(text, to);
    return { ok: true, messageId: result.message_id };
  } catch (error: any) {
    options?.log?.error?.(`[WPS] sendMessage failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}
