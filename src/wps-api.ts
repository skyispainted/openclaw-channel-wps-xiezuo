import { companyTokenManager } from "./company-token.js";
import { oauthTokenManager } from "./oauth-token.js";
import { calculateWPS3Signature, calculateContentMd5, getRFC1123Date, generateKSO1AuthHeader } from "./crypto.js";

export interface WPSResponse {
  result: number;
  msg?: string;
  message_id?: string;
}

export class WPSClient {
  private readonly appId: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly timeout: number = 10000; // 10秒超时

  constructor(appId: string, secretKey: string, apiUrl: string) {
    this.appId = appId;
    this.secretKey = secretKey;
    this.apiUrl = apiUrl;
  }

  /**
   * 获取会话消息文件下载地址
   *
   * API文档: https://openapi.wps.cn/v7/chats/{chat_id}/messages/{message_id}/resources/{storage_key}/download
   * 方法: GET
   * 权限: kso.chat_message.readwrite
   *
   * @param chatId 会话ID
   * @param messageId 消息ID
   * @param storageKey 文件的storage_key
   * @param fileName 可选，下载的文件名称
   * @returns 临时下载链接
   */
  async getDownloadUrl(
    chatId: string,
    messageId: string,
    storageKey: string,
    fileName?: string
  ): Promise<string> {
    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    // 构造API路径
    const path = `/v7/chats/${chatId}/messages/${messageId}/resources/${storageKey}/download`;

    // 查询参数
    const queryParams = new URLSearchParams();
    if (fileName) {
      queryParams.set("file_name", fileName);
    }

    const fullPath = queryParams.toString()
      ? `${path}?${queryParams.toString()}`
      : path;

    console.log(`[DEBUG] 调用文件下载API: GET ${fullPath}`);

    try {
      const result = await this.sendV7Request("GET", fullPath, null, accessToken);

      console.log(`[DEBUG] 文件下载API响应:`, JSON.stringify(result));

      // 响应格式: { "data": { "url": "string" }, "code": 0, "msg": "string" }
      if (result.code === 0 && result.data?.url) {
        console.log(`[DEBUG] 成功获取下载链接`);
        return result.data.url;
      }

      throw new Error(`API返回错误: ${result.msg || "未知错误"}`);
    } catch (error) {
      console.error(`[ERROR] 获取文件下载链接失败:`, error);
      throw error;
    }
  }

  /**
   * 下载文件到Buffer
   */
  async downloadFile(storageKey: string): Promise<Buffer> {
    const downloadUrl = await this.getDownloadUrl(storageKey);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`文件下载失败 ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async sendTextMessage(
    text: string,
    chatId: string
  ): Promise<WPSResponse> {
    // 参数验证
    if (!text || text.trim().length === 0) {
      throw new Error("消息内容不能为空");
    }

    if (!chatId) {
      throw new Error("chatId 不能为空");
    }

    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    const message = {
      type: "text",
      receiver: {
        receiver_id: chatId,
        type: "chat"
      },
      content: {
        text: {
          content: text.trim(),
          type: "plain"
        }
      }
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  private async sendV7Request(
    method: string,
    path: string,
    body: any,
    accessToken: string
  ): Promise<any> {
    const url = `${this.apiUrl}${path}`;
    const contentType = "application/json";
    const ksoDate = getRFC1123Date();
    const bodyString = JSON.stringify(body);

    const ksoSignature = generateKSO1AuthHeader(
      this.appId,
      method,
      path,
      contentType,
      ksoDate,
      bodyString,
      this.secretKey
    );

    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": contentType,
          "X-Kso-Date": ksoDate,
          "X-Kso-Authorization": ksoSignature,
          "Authorization": `Bearer ${accessToken}`,
        },
        body: bodyString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WPS API请求失败 ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("WPS API请求超时");
      }

      throw error;
    }
  }

  /**
   * 测试连接（用于probe）
   */
  async testConnection(): Promise<boolean> {
    try {
      const accessToken = await oauthTokenManager.getAccessToken(
        this.appId,
        this.secretKey,
        this.apiUrl
      );
      return true;
    } catch (error) {
      throw new Error(`连接测试失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
