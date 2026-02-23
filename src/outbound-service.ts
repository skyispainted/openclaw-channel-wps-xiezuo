import { WPSClient } from "./wps-api.js";

/**
 * 发送文本消息
 */
export async function sendMessage(
  config: any,
  to: string,
  text: string,
  options?: { log?: any }
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    const client = new WPSClient(
      config.appId,
      config.secretKey,
      config.apiUrl || "https://openapi.wps.cn"
    );

    await client.sendTextMessage(text, to);
    return { ok: true };
  } catch (error: any) {
    options?.log?.error?.(`[WPS] sendMessage failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}