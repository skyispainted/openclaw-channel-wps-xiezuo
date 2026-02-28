import {
  registerPluginHttpRoute,
  type ChannelGatewayContext,
} from "openclaw/plugin-sdk";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SimpleXiezuoAccountConfig } from "./config-schema.js";
import { parseWPSMessage, type WPSEvent } from "./message-parser.js";
import { verifyEventSignature, decryptEventData } from "./crypto.js";
import { handleWpsMessage } from "./channel.js";

// 常量定义
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const REQUEST_TIMEOUT = 30000; // 30秒

/**
 * 读取请求体（带大小限制）
 */
async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    // 设置超时
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, REQUEST_TIMEOUT);

    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;

      // 防止请求体过大
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        clearTimeout(timeout);
        reject(new Error("Request body too large"));
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * 发送 JSON 响应
 */
function sendJsonResponse(res: ServerResponse, statusCode: number, data: any): void {
  if (res.writableEnded) return;

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

/**
 * 启动WPS协作账号Gateway
 */
export async function startSimpleXiezuoAccount(ctx: ChannelGatewayContext<any>): Promise<{
  stop: () => void;
}> {
  const accountId = ctx.account.accountId;
  const config = ctx.account.config as SimpleXiezuoAccountConfig;

  // 验证必需配置
  if (!config.appId || !config.secretKey) {
    throw new Error("WPS协作配置不完整，需要appId和secretKey");
  }

  // 更新运行时状态
  ctx.setStatus({
    ...ctx.getStatus(),
    running: true,
    lastStartAt: Date.now(),
    lastError: null,
  });

  ctx.log?.info?.(`[${accountId}] WPS协作Gateway启动`);

  // 固定的回调路径
  const callbackPath = "/wps-xiezuo/webhook";

  // 自动构建 webhook 地址（从 OpenClaw 运行时获取）
  const gatewayHost = ctx.cfg?.gateway?.customBindHost || "localhost";
  const gatewayPort = ctx.cfg?.gateway?.port || 18789;
  const webhookUrl = `http://${gatewayHost}:${gatewayPort}${callbackPath}`;

  ctx.log?.info?.(`[${accountId}] Webhook 地址: ${webhookUrl}`);

  const unregisterCallback = registerPluginHttpRoute({
    pluginId: "wps-xiezuo",
    accountId,
    path: callbackPath,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const method = req.method;
        const path = url.pathname;
        const query = Object.fromEntries(url.searchParams);

        // 记录接收到的请求
        ctx.log?.debug?.(`[${accountId}] [Webhook] 📥 接收请求: ${method} ${path}`);
        ctx.log?.debug?.(`[${accountId}] [Webhook] Query: ${JSON.stringify(query)}`);
        ctx.log?.debug?.(`[${accountId}] [Webhook] Headers: Content-Type=${req.headers["content-type"]}`);

        // GET 请求：Challenge 验证（WPS后台配置时的URL验证）
        if (req.method === "GET") {
          ctx.log?.info?.(`[${accountId}] [Webhook] 🔍 处理 Challenge 验证请求`);
          await handleCallbackVerification(req, res, url, ctx, accountId);
          return;
        }

        // POST 请求：消息事件
        if (req.method === "POST") {
          ctx.log?.debug?.(`[${accountId}] [Webhook] 📨 处理 POST 消息事件`);
          await handlePostRequest(req, res, url, ctx, accountId, config);
          return;
        }

        // 其他方法不支持
        ctx.log?.warn?.(`[${accountId}] [Webhook] ⚠️ 不支持的 HTTP 方法: ${method}`);
        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST");
        res.end("Method Not Allowed");
      } catch (error) {
        ctx.log?.error?.(`[${accountId}] [Webhook] ❌ HTTP 处理错误: ${error}`);
        if (!res.writableEnded) {
          sendJsonResponse(res, 500, { code: -1, msg: "Internal server error" });
        }
      }
    },
  });

  // 创建 stop 回调
  let stopCallback: (() => void) | null = null;
  const waitForStop = new Promise<void>((resolve) => {
    stopCallback = () => resolve();

    // 监听框架的 abort signal
    if (ctx.abortSignal) {
      ctx.abortSignal.addEventListener("abort", () => {
        if (stopCallback) {
          stopCallback();
        }
      });
    }
  });

  await waitForStop;

  ctx.log?.info?.(`[${accountId}] 🛑 WPS协作Gateway停止`);
  if (typeof unregisterCallback === "function") {
    unregisterCallback();
  }

  ctx.setStatus({
    ...ctx.getStatus(),
    running: false,
    lastStopAt: Date.now(),
  });

  return {
    stop: () => {
      if (stopCallback) {
        stopCallback();
        stopCallback = null;
      }
    },
  };
}

/**
 * 处理 POST 请求
 */
async function handlePostRequest(
  req: IncomingMessage,
  res: any,
  url: URL,
  ctx: ChannelGatewayContext,
  accountId: string,
  config: SimpleXiezuoAccountConfig
): Promise<void> {
  try {
    const rawBody = await readBody(req);
    const bodyString = rawBody.toString("utf8");

    if (!bodyString) {
      ctx.log?.warn?.(`[${accountId}] [Webhook] ⚠️ 空请求体`);
      sendJsonResponse(res, 400, { code: -1, msg: "Empty body" });
      return;
    }

    // 记录请求体信息
    ctx.log?.debug?.(`[${accountId}] [Webhook] Body size: ${rawBody.length} bytes`);
    ctx.log?.trace?.(`[${accountId}] [Webhook] Raw body: ${bodyString}`);

    // 验证 Content-Type
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      ctx.log?.warn?.(`[${accountId}] [Webhook] ⚠️ Content-Type 不是 JSON: ${contentType}`);
      sendJsonResponse(res, 400, { code: -1, msg: "Content-Type must be application/json" });
      return;
    }

    const body = JSON.parse(bodyString);

    // Challenge 验证（POST 方式）
    if (body.challenge) {
      ctx.log?.info?.(`[${accountId}] [Challenge] 收到 POST Challenge: ${body.challenge}`);
      ctx.log?.debug?.(`[${accountId}] [Challenge] 即将返回: { challenge: "${body.challenge}" }`);
      sendJsonResponse(res, 200, { challenge: body.challenge });
      ctx.log?.info?.(`[${accountId}] [Challenge] ✅ 已成功响应 POST challenge 验证`);
      return;
    }

    // 消息事件
    if (body.topic === "kso.app_chat.message") {
      ctx.log?.info?.(`[${accountId}] [Event] 收到消息事件: ${body.topic}`);
      ctx.log?.debug?.(`[${accountId}] [Event] 消息签名: ${body.signature || "无"}`);
      ctx.log?.debug?.(`[${accountId}] [Event] 是否加密: ${body.encrypted_data ? "是" : "否"}`);
      await handleMessageEvent(body, res, ctx, accountId, config);
      return;
    }

    // 回调事件
    if (body.callback_name) {
      ctx.log?.info?.(`[${accountId}] [Callback] 收到回调事件: ${body.callback_name}`);
      await handleCallback(body, res, ctx, accountId, config);
      return;
    }

    // 未知事件类型
    ctx.log?.warn?.(`[${accountId}] [Webhook] ⚠️ 未知事件类型，已忽略`);
    sendJsonResponse(res, 200, { code: 0, msg: "ok" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      ctx.log?.error?.(`[${accountId}] [Webhook] ❌ JSON 格式错误: ${error.message}`);
      sendJsonResponse(res, 400, { code: -1, msg: "Invalid JSON" });
    } else if (error instanceof Error && error.message === "Request body too large") {
      ctx.log?.error?.(`[${accountId}] [Webhook] ❌ 请求体过大`);
      sendJsonResponse(res, 413, { code: -1, msg: "Request body too large" });
    } else if (error instanceof Error && error.message === "Request timeout") {
      ctx.log?.error?.(`[${accountId}] [Webhook] ❌ 请求超时`);
      sendJsonResponse(res, 408, { code: -1, msg: "Request timeout" });
    } else {
      ctx.log?.error?.(`[${accountId}] [Webhook] ❌ 内部错误: ${error}`);
      sendJsonResponse(res, 500, { code: -1, msg: "Internal error" });
    }
  }
}

/**
 * 处理回调URL验证
 */
async function handleCallbackVerification(
  req: IncomingMessage,
  res: any,
  url: URL,
  ctx: ChannelGatewayContext<any>,
  accountId: string
): Promise<void> {
  const challengeFromQuery = url.searchParams.get("challenge");

  // 记录接收到的 Challenge 验证请求
  ctx.log?.info?.(`[${accountId}] [Challenge] 收到 URL 验证请求`);
  ctx.log?.debug?.(`[${accountId}] [Challenge] 完整 URL: ${url.toString()}`);
  ctx.log?.debug?.(`[${accountId}] [Challenge] Query: ${JSON.stringify(Object.fromEntries(url.searchParams))}`);

  if (challengeFromQuery) {
    ctx.log?.info?.(`[${accountId}] [Challenge] 收到 challenge 值: ${challengeFromQuery}`);
    ctx.log?.debug?.(`[${accountId}] [Challenge] 即将返回: { challenge: "${challengeFromQuery}" }`);
    sendJsonResponse(res, 200, { challenge: challengeFromQuery });
    ctx.log?.info?.(`[${accountId}] [Challenge] ✅ 已成功响应 challenge 验证`);
    return;
  }

  ctx.log?.warn?.(`[${accountId}] [Challenge] ⚠️ 未检测到 challenge 参数，返回默认响应`);
  sendJsonResponse(res, 200, { code: 0, msg: "ok" });
  ctx.log?.debug?.(`[${accountId}] [Challenge] 已返回默认响应: { code: 0, msg: "ok" }`);
}

/**
 * 处理消息事件
 */
async function handleMessageEvent(
  eventBody: any,
  res: any,
  ctx: ChannelGatewayContext<any>,
  accountId: string,
  config: SimpleXiezuoAccountConfig
): Promise<void> {
  // 立即响应 WPS（异步处理消息）
  ctx.log?.debug?.(`[${accountId}] [Message] 📤 立即响应 WPS: { code: 0, msg: "success" }`);
  sendJsonResponse(res, 200, { code: 0, msg: "success" });

  try {
    if (eventBody.signature && config.appId && config.secretKey) {
      ctx.log?.debug?.(`[${accountId}] [Message] 🔐 验证事件签名...`);
      const isValid = verifyEventSignature(
        config.appId,
        config.secretKey,
        eventBody.topic,
        eventBody.nonce,
        eventBody.time,
        eventBody.encrypted_data,
        eventBody.signature
      );

      if (!isValid) {
        ctx.log?.error?.(`[${accountId}] [Message] ❌ 事件签名验证失败！`);
        return;
      }
      ctx.log?.debug?.(`[${accountId}] [Message] ✅ 事件签名验证通过`);
    }

    let eventData: WPSEvent;
    if (eventBody.encrypted_data && config.encryptKey) {
      ctx.log?.debug?.(`[${accountId}] [Message] 🔓 解密事件数据...`);
      const decryptedJson = decryptEventData(
        config.encryptKey,
        eventBody.encrypted_data,
        eventBody.nonce
      );
      eventData = JSON.parse(decryptedJson);
      ctx.log?.trace?.(`[${accountId}] [Message] 解密后数据: ${decryptedJson}`);
    } else {
      ctx.log?.debug?.(`[${accountId}] [Message] 📋 使用未加密数据`);
      eventData = eventBody.data || eventBody;
    }

    ctx.log?.info?.(`[${accountId}] [Message] 🔄 调用 handleWpsMessage 处理消息`);
    await handleWpsMessage({
      cfg: ctx.cfg,
      accountId,
      event: eventData,
      log: ctx.log,
    });
  } catch (error) {
    ctx.log?.error?.(`[${accountId}] [Message] ❌ 消息处理异常: ${error}`);
  }
}

/**
 * 处理回调（卡片交互等）
 */
async function handleCallback(
  body: any,
  res: any,
  ctx: ChannelGatewayContext<any>,
  accountId: string,
  config: SimpleXiezuoAccountConfig
): Promise<void> {
  ctx.log?.debug?.(`[${accountId}] [Callback] 📤 响应卡片回调: { code: 0, msg: "success" }`);
  sendJsonResponse(res, 200, { code: 0, msg: "success" });

  ctx.log?.info?.(`[${accountId}] [Callback] 📋 收到卡片回调事件`);
  ctx.log?.debug?.(`[${accountId}] [Callback] 回调名称: ${body.callback_name}`);
  ctx.log?.trace?.(`[${accountId}] [Callback] 完整数据: ${JSON.stringify(body)}`);

  // TODO: 实现卡片交互逻辑
  ctx.log?.warn?.(`[${accountId}] [Callback] ⚠️ 卡片交互逻辑未实现 (TODO)`);
}