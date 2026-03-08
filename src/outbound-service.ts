import { WPSClient } from "./wps-api.js";
import { getCompleteConfig } from "./company-id-cache.js";

/**
 * 发送消息的参数
 */
export interface SendMessageOptions {
  log?: any;
}

/**
 * 发送文本消息到指定聊天
 *
 * @param config 配置对象（包含 appId, secretKey, apiUrl 等）
 * @param to 目标聊天ID（可以是用户ID或群聊ID）
 * @param text 消息文本内容
 * @param chatType 会话类型："p2p"=私聊，"group"=群聊
 * @param options 可选参数（包含日志记录器等）
 * @returns 消息发送结果
 */
export async function sendMessage(
  config: any,
  to: string,
  text: string,
  chatType: string,
  options?: SendMessageOptions
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    // 使用缓存的完整配置（包含companyId）
    const completeConfig = getCompleteConfig(config.accountId || "default", config);

    const client = new WPSClient(
      completeConfig.appId,
      completeConfig.secretKey,
      completeConfig.apiUrl || "https://openapi.wps.cn"
    );

    // 打印ParsedMessage关键信息用于debug
    options?.log?.debug?.(`[WPS Outbound] 准备发送消息`);
    options?.log?.debug?.(`[WPS Outbound] 消息信息:`);
    options?.log?.debug?.(`[WPS Outbound]   - chatType: ${chatType}`);
    options?.log?.debug?.(`[WPS Outbound]   - to: ${to}`);
    options?.log?.debug?.(`[WPS Outbound]   - text: "${text?.slice(0, 50)}${text && text.length > 50 ? '...' : ''}"`);
    options?.log?.debug?.(`[WPS Outbound]   - accountId: ${config.accountId || "default"}`);
    options?.log?.debug?.(`[WPS Outbound]   - appId: ${completeConfig.appId}`);

    // 简单发送文本消息，需要传入chatType
    const result = await client.sendTextMessage(text, to, chatType);
    options?.log?.debug?.(`[WPS Outbound] 消息发送成功 - messageId: ${result.message_id}`);
    return { ok: true, messageId: result.message_id };
  } catch (error: any) {
    options?.log?.error?.(`[WPS] sendMessage failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/**
 * 发送媒体消息到指定聊天
 *
 * @param config 配置对象（包含 appId, secretKey, apiUrl 等）
 * @param to 目标聊天ID（可以是用户ID或群聊ID）
 * @param mediaPath 媒体文件路径
 * @param mediaType 媒体类型
 * @param chatType 会话类型："p2p"=私聊，"group"=群聊
 * @param options 可选参数（包含日志记录器等）
 * @returns 消息发送结果
 */
export async function sendMedia(
  config: any,
  to: string,
  mediaPath: string,
  mediaType: "image" | "file" | "video" | "audio" = "image",
  chatType: string,
  options?: SendMessageOptions
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    // 使用缓存的完整配置（包含companyId）
    const completeConfig = getCompleteConfig(config.accountId || "default", config);

    const client = new WPSClient(
      completeConfig.appId,
      completeConfig.secretKey,
      completeConfig.apiUrl || "https://openapi.wps.cn"
    );

    // 上传媒体文件并获取storage key
    const fileName = mediaPath.split('/').pop() || 'file';

    // 打印ParsedMessage关键信息用于debug
    options?.log?.debug?.(`[WPS Outbound] 准备发送媒体消息`);
    options?.log?.debug?.(`[WPS Outbound] 媒体消息信息:`);
    options?.log?.debug?.(`[WPS Outbound]   - chatType: ${chatType}`);
    options?.log?.debug?.(`[WPS Outbound]   - to: ${to}`);
    options?.log?.debug?.(`[WPS Outbound]   - mediaPath: ${mediaPath}`);
    options?.log?.debug?.(`[WPS Outbound]   - mediaType: ${mediaType}`);
    options?.log?.debug?.(`[WPS Outbound]   - fileName: ${fileName}`);
    options?.log?.debug?.(`[WPS Outbound]   - accountId: ${config.accountId || "default"}`);
    options?.log?.debug?.(`[WPS Outbound]   - appId: ${completeConfig.appId}`);

    if (mediaType === "image") {
      // 发送图片消息，需要传入chatType
      const result = await client.sendImageMessage(mediaPath, to, chatType, {
        name: fileName,
        type: "image/jpg" // 默认类型，可以根据实际文件类型调整
      });
      options?.log?.debug?.(`[WPS Outbound] 图片消息发送成功 - messageId: ${result.message_id}`);
      return { ok: true, messageId: result.message_id };
    } else {
      // 发送文件消息，需要传入chatType
      const result = await client.sendFileMessage(mediaPath, to, chatType, fileName);
      options?.log?.debug?.(`[WPS Outbound] 文件消息发送成功 - messageId: ${result.message_id}`);
      return { ok: true, messageId: result.message_id };
    }
  } catch (error: any) {
    options?.log?.error?.(`[WPS] sendMedia failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}
