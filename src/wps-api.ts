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
   * 发送V7请求（支持GET/POST等方法）
   */
  private async sendV7Request(
    method: string,
    path: string,
    body: any,
    accessToken: string
  ): Promise<any> {
    const url = `${this.apiUrl}${path}`;
    const contentType = body ? "application/json" : undefined;
    const ksoDate = getRFC1123Date();
    const bodyString = body ? JSON.stringify(body) : "";

    const ksoSignature = generateKSO1AuthHeader(
      this.appId,
      method,
      path,
      contentType || "",
      ksoDate,
      bodyString,
      this.secretKey
    );

    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          "X-Kso-Date": ksoDate,
          "X-Kso-Authorization": ksoSignature,
          "Authorization": `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      };

      // 只有POST/PUT等方法才设置body和Content-Type
      if (method !== "GET" && method !== "HEAD" && body) {
        fetchOptions.headers!["Content-Type"] = contentType!;
        fetchOptions.body = bodyString;
      }

      const response = await fetch(url, fetchOptions);

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

  /**
   * ==================== 消息发送功能 ====================
   */

  /**
   * 发送文本消息
   *
   * @param text 消息内容
   * @param chatId 会话ID
   * @param type 消息类型: "plain" | "markdown"
   * @returns 消息发送结果
   */
  async sendTextMessage(
    text: string,
    chatId: string,
    type: "plain" | "markdown" = "plain"
  ): Promise<WPSResponse> {
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
        type: "chat",
      },
      content: {
        text: {
          content: text.trim(),
          type: type,
        },
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  /**
   * 发送富文本消息
   *
   * @param elements 富文本元素数组
   * @param chatId 会话ID
   * @returns 消息发送结果
   */
  async sendRichTextMessage(
    elements: RichTextElement[],
    chatId: string
  ): Promise<WPSResponse> {
    if (!elements || elements.length === 0) {
      throw new Error("富文本内容不能为空");
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
      type: "rich_text",
      receiver: {
        receiver_id: chatId,
        type: "chat",
      },
      content: {
        rich_text: {
          elements: elements,
        },
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送富文本消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  /**
   * 发送图片消息
   *
   * @param storageKey 图片存储key
   * @param chatId 会话ID
   * @param options 可选参数
   * @returns 消息发送结果
   */
  async sendImageMessage(
    storageKey: string,
    chatId: string,
    options?: {
      type?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
      name?: string;
      size?: number;
      width?: number;
      height?: number;
      thumbnailStorageKey?: string;
      thumbnailType?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
    }
  ): Promise<WPSResponse> {
    if (!storageKey) {
      throw new Error("storageKey 不能为空");
    }

    if (!chatId) {
      throw new Error("chatId 不能为空");
    }

    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    const imageContent: any = {
      storage_key: storageKey,
      type: options?.type || "image/jpeg",
      name: options?.name,
      size: options?.size,
      width: options?.width,
      height: options?.height,
    };

    if (options?.thumbnailStorageKey) {
      imageContent.thumbnail_storage_key = options.thumbnailStorageKey;
      imageContent.thumbnail_type = options.thumbnailType || options.type || "image/jpeg";
    }

    const message = {
      type: "image",
      receiver: {
        receiver_id: chatId,
        type: "chat",
      },
      content: {
        image: imageContent,
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送图片消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  /**
   * 发送文件消息（本地文件）
   *
   * @param storageKey 文件存储key
   * @param chatId 会话ID
   * @param name 文件名称
   * @param size 文件大小（可选）
   * @returns 消息发送结果
   */
  async sendFileMessage(
    storageKey: string,
    chatId: string,
    name: string,
    size?: number
  ): Promise<WPSResponse> {
    if (!storageKey) {
      throw new Error("storageKey 不能为空");
    }

    if (!chatId) {
      throw new Error("chatId 不能为空");
    }

    if (!name) {
      throw new Error("文件名称不能为空");
    }

    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    const message = {
      type: "file",
      receiver: {
        receiver_id: chatId,
        type: "chat",
      },
      content: {
        file: {
          type: "local",
          local: {
            storage_key: storageKey,
            name: name,
            size: size,
          },
        },
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送文件消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  /**
   * 发送音频消息
   *
   * @param storageKey 音频存储key
   * @param chatId 会话ID
   * @param options 音频信息
   * @returns 消息发送结果
   */
  async sendAudioMessage(
    storageKey: string,
    chatId: string,
    options: {
      duration: number;
      format?: "wav" | "amr";
      codec?: "amr";
      sampleRate?: number;
      sampleBits?: number;
      channels?: number;
      size?: number;
    }
  ): Promise<WPSResponse> {
    if (!storageKey) {
      throw new Error("storageKey 不能为空");
    }

    if (!chatId) {
      throw new Error("chatId 不能为空");
    }

    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    const audioContent = {
      storage_key: storageKey,
      media: {
        duration: options.duration,
        format: options.format || "wav",
        codec: options.codec,
        sample_rate: options.sampleRate,
        sample_bits: options.sampleBits,
        channels: options.channels,
        size: options.size,
      },
    };

    const message = {
      type: "audio",
      receiver: {
        receiver_id: chatId,
        type: "chat",
      },
      content: {
        audio: audioContent,
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送音频消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
  }

  /**
   * 发送视频消息
   *
   * @param storageKey 视频存储key
   * @param chatId 会话ID
   * @param options 视频信息
   * @returns 消息发送结果
   */
  async sendVideoMessage(
    storageKey: string,
    chatId: string,
    options: {
      duration: number;
      format?: "mp4";
      codec?: "h.264";
      width?: number;
      height?: number;
      size?: number;
      coverStorageKey?: string;
    }
  ): Promise<WPSResponse> {
    if (!storageKey) {
      throw new Error("storageKey 不能为空");
    }

    if (!chatId) {
      throw new Error("chatId 不能为空");
    }

    const accessToken = await oauthTokenManager.getAccessToken(
      this.appId,
      this.secretKey,
      this.apiUrl
    );

    const videoContent: any = {
      storage_key: storageKey,
      media: {
        duration: options.duration,
        format: options.format || "mp4",
        codec: options.codec || "h.264",
        width: options.width,
        height: options.height,
        size: options.size,
      },
    };

    if (options.coverStorageKey) {
      videoContent.media.cover_storage_key = options.coverStorageKey;
    }

    const message = {
      type: "video",
      receiver: {
        receiver_id: chatId,
        type: "chat",
      },
      content: {
        video: videoContent,
      },
    };

    const path = `/v7/messages/create`;
    const result = await this.sendV7Request("POST", path, message, accessToken);

    if (result.code !== 0) {
      throw new Error(`发送视频消息失败: ${result.msg || "未知错误"}`);
    }

    return { result: result.code, msg: result.msg, message_id: result.data?.message_id };
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

/**
 * ==================== 富文本消息类型定义 ====================
 */

/**
 * 富文本元素基础类型
 */
export interface RichTextElement {
  type: string;
  alt_text: string;
  indent: number;
  index: number;
  elements?: RichTextElement[];
  text_content?: {
    content: string;
    type?: "plain" | "markdown";
  };
  style_text_content?: {
    style: {
      bold?: boolean;
      color?: string;
      italic?: boolean;
    };
    text: string;
  };
  mention_content?: {
    identity?: {
      avatar?: string;
      company_id?: string;
      id: string;
      name: string;
      type: "user" | "sp";
    };
    text: string;
    type?: string;
  };
  image_content?: {
    size?: number;
    height?: number;
    width?: number;
    name?: string;
    type?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
    storage_key: string;
    thumbnail_type?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
    thumbnail_storage_key?: string;
  };
  link_content?: {
    text: string;
    url: string;
  };
  doc_content?: {
    text: string;
    file: {
      id: string;
      link_url: string;
      link_id: string;
    };
  };
}

/**
 * 创建纯文本元素
 */
export function createTextElement(
  content: string,
  index: number,
  type: "plain" | "markdown" = "plain"
): RichTextElement {
  return {
    type: "text",
    alt_text: content,
    indent: 0,
    index: index,
    elements: [
      {
        type: "text",
        alt_text: content,
        indent: 0,
        index: 0,
        text_content: {
          content: content,
          type: type,
        },
      },
    ],
  };
}

/**
 * 创建有样式的文本元素
 */
export function createStyledTextElement(
  text: string,
  index: number,
  style?: { bold?: boolean; color?: string; italic?: boolean }
): RichTextElement {
  return {
    type: "text",
    alt_text: text,
    indent: 0,
    index: index,
    elements: [
      {
        type: "text",
        alt_text: text,
        indent: 0,
        index: 0,
        style_text_content: {
          style: style || {},
          text: text,
        },
      },
    ],
  };
}

/**
 * 创建@人元素
 */
export function createMentionElement(
  userId: string,
  userName: string,
  index: number,
  companyId?: string
): RichTextElement {
  return {
    type: "mention",
    alt_text: `@${userName}`,
    indent: 0,
    index: index,
    elements: [
      {
        type: "mention",
        alt_text: `@${userName}`,
        indent: 0,
        index: 0,
        mention_content: {
          identity: {
            id: userId,
            name: userName,
            type: "user",
            company_id: companyId,
          },
          text: `@${userName}`,
        },
      },
    ],
  };
}

/**
 * 创建图片元素
 */
export function createImageElement(
  storageKey: string,
  index: number,
  options?: {
    name?: string;
    type?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
    size?: number;
    width?: number;
    height?: number;
    thumbnailStorageKey?: string;
    thumbnailType?: "image/png" | "image/jpg" | "image/gif" | "image/webp";
  }
): RichTextElement {
  return {
    type: "image",
    alt_text: "[图片]",
    indent: 0,
    index: index,
    elements: [
      {
        type: "image",
        alt_text: "[图片]",
        indent: 0,
        index: 0,
        image_content: {
          storage_key: storageKey,
          name: options?.name,
          type: options?.type || "image/jpeg",
          size: options?.size,
          width: options?.width,
          height: options?.height,
          thumbnail_storage_key: options?.thumbnailStorageKey,
          thumbnail_type: options?.thumbnailType || options?.type || "image/jpeg",
        },
      },
    ],
  };
}

/**
 * 创建链接元素
 */
export function createLinkElement(
  text: string,
  url: string,
  index: number
): RichTextElement {
  return {
    type: "link",
    alt_text: text,
    indent: 0,
    index: index,
    elements: [
      {
        type: "link",
        alt_text: text,
        indent: 0,
        index: 0,
        link_content: {
          text: text,
          url: url,
        },
      },
    ],
  };
}

/**
 * 创建内嵌文档元素
 */
export function createDocElement(
  text: string,
  fileId: string,
  linkUrl: string,
  linkId: string,
  index: number
): RichTextElement {
  return {
    type: "doc",
    alt_text: text,
    indent: 0,
    index: index,
    elements: [
      {
        type: "doc",
        alt_text: text,
        indent: 0,
        index: 0,
        doc_content: {
          text: text,
          file: {
            id: fileId,
            link_url: linkUrl,
            link_id: linkId,
          },
        },
      },
    ],
  };
}
