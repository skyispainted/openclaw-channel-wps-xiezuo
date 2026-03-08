import { type OpenClawConfig, type ChannelPlugin } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema, DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { SimpleXiezuoConfig, SimpleXiezuoAccountConfig } from "./config-schema.js";
import { SimpleXiezuoConfigSchema } from "./config-schema.js";
import { startSimpleXiezuoAccount } from "./gateway.js";
import { getConfig, listWpsXiezuoAccountIds, resolveWpsXiezuoAccount } from "./utils.js";
import { getWpsXiezuoRuntime } from "./runtime.js";
import { setCurrentLogger } from "./logger-context.js";
import { isMessageProcessed, markMessageProcessed } from "./dedup.js";
import { normalizeAllowFrom, isSenderAllowed, isSenderGroupAllowed } from "./access-control.js";
import type { WPSEvent, ParsedMessage } from "./message-parser.js";
import { parseWPSMessage } from "./message-parser.js";
import { WPSClient } from "./wps-api.js";
import { sendMessage, sendMedia } from "./outbound-service.js";
import { wpsXiezuoOnboardingAdapter } from "./onboarding.js";
import { getCompleteConfig } from "./company-id-cache.js";

// 处理中的消息键（用于防止并发处理同一消息）
const processingMessageKeys = new Set<string>();

export type ResolvedWpsXiezuoAccount = any;

/**
 * WPS协作 Channel 定义
 */
export const simpleXiezuoPlugin: ChannelPlugin = {
  id: "wps-xiezuo",
  meta: {
    id: "wps-xiezuo",
    label: "WPS协作",
    selectionLabel: "WPS协作 (WPS Xiezuo)",
    docsPath: "/channels/wps-xiezuo",
    blurb: "WPS协作企业内部机器人，通过HTTP回调模式接收消息。",
    aliases: ["wps", "xiezuo"],
  },
  configSchema: buildChannelConfigSchema(SimpleXiezuoConfigSchema),
  onboarding: wpsXiezuoOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reply: true,
    edit: true,
    reactions: true,
    nativeCommands: true,
    blockStreaming: true,
  },
  reload: {
    configPrefixes: ["channels.wps-xiezuo"],
  },
  config: {
    listAccountIds: (cfg: OpenClawConfig): string[] => {
      const ids = listWpsXiezuoAccountIds(cfg);
      return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
    },
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => {
      const id = accountId || DEFAULT_ACCOUNT_ID;
      const account = resolveWpsXiezuoAccount(cfg, id);
      const configured = Boolean(account.appId && account.secretKey);

      return {
        accountId: id,
        config: account,
        enabled: account.enabled !== false,
        configured,
        name: account.name || null,
      };
    },
    defaultAccountId: (): string => DEFAULT_ACCOUNT_ID,
    isConfigured: (account: any): boolean =>
      Boolean(account.config?.appId && account.config?.secretKey),
    describeAccount: (account: any) => ({
      accountId: account.accountId,
      name: account.config?.name || account.accountId,
      enabled: account.enabled,
      configured: Boolean(account.config?.appId),
    }),
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: account.config?.dmPolicy || "open",
      allowFrom: account.config?.allowFrom || [],
      policyPath: "channels.wps-xiezuo.dmPolicy",
      allowFromPath: "channels.wps-xiezuo.allowFrom",
      approveHint: "使用 /allow wps-xiezuo:<userId> 批准用户",
      normalizeEntry: (raw: string) => raw.replace(/^(wps|wps-xiezuo|xiezuo):/i, ""),
    }),
  },
  groups: {
    resolveRequireMention: ({ cfg }) => {
      const config = getConfig(cfg);
      return config.requireMention !== false;
    },
    resolveGroupIntroHint: ({ groupId, groupChannel }) => {
      const parts = [`chatId=${groupId}`];
      if (groupChannel) {
        parts.push(`sessionKey=${groupChannel}`);
      }
      return `WPS IDs: ${parts.join(", ")}.`;
    },
  },
  messaging: {
    normalizeTarget: (raw: string) => (raw ? raw.replace(/^(wps|wps-xiezuo|xiezuo):/i, "") : undefined),
    targetResolver: {
      looksLikeId: (id: string): boolean => /^[\w+\-/=]+$/.test(id),
      hint: "<chatId>",
    },
  },
  outbound: {
    deliveryMode: "direct" as const,
    resolveTarget: ({ to }: any) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false as const,
          error: new Error("WPS message requires --to <chatId>"),
        };
      }
      // 检查是否只有渠道前缀而没有实际的chatId
      if (trimmed === "wps-xiezuo" || trimmed === "wps" || trimmed === "xiezuo") {
        return {
          ok: false as const,
          error: new Error(`Invalid target: "${trimmed}". Please specify a chatId, e.g., --to wps-xiezuo:<chatId>`),
        };
      }
      const targetId = trimmed.replace(/^(wps|wps-xiezuo|xiezuo):/i, "");
      if (!targetId) {
        return {
          ok: false as const,
          error: new Error(`Invalid target format: "${trimmed}". Expected format: wps-xiezuo:<chatId>`),
        };
      }
      return { ok: true as const, to: targetId };
    },
    sendText: async ({ cfg, to, text, accountId, log }: any) => {
      const account = resolveWpsXiezuoAccount(cfg, accountId);
      log?.debug?.(`[WPS] outbound sendText called - rawTo=${to}, text=${text?.slice(0, 30)}`);
      if (!account.appId || !account.secretKey) {
        throw new Error("WPS not configured");
      }

      // 使用预加载的完整配置（包含companyId）
      const completeConfig = getCompleteConfig(accountId, {
        ...account,
        accountId,
      });

      try {
        // 从 to 参数判断 chatType
        // WPS API 中，私聊使用 receiver.type="user"，群聊使用 "chat"
        // 根据 OpenClaw 规范，私聊的 to 参数可能包含 user: 前缀
        const chatType = to?.startsWith("user:") ? "p2p" : "chat";

        log?.debug?.(`[WPS] outbound sendText - to=${to}, chatType=${chatType}`);
        const result = await sendMessage(completeConfig, to, text, chatType, { log });
        if (!result.ok) {
          throw new Error(result.error || "sendText failed");
        }
        return {
          channel: "wps-xiezuo",
          messageId: result.messageId || undefined,
        };
      } catch (err: any) {
        log?.error?.(`[WPS] outbound sendText error: ${err.message}`);
        throw new Error(`sendText failed: ${err.message}`, { cause: err });
      }
    },
    sendMedia: async ({
      cfg,
      to,
      mediaPath,
      filePath,
      mediaUrl,
      mediaType: providedMediaType,
      accountId,
      log,
    }: any) => {
      const account = resolveWpsXiezuoAccount(cfg, accountId);
      log?.debug?.(`[WPS] outbound sendMedia called - rawTo=${to}, mediaPath=${mediaPath}, mediaType=${providedMediaType}`);
      if (!account.appId || !account.secretKey) {
        throw new Error("WPS not configured");
      }

      // 使用预加载的完整配置（包含companyId）
      const completeConfig = getCompleteConfig(accountId, {
        ...account,
        accountId,
      });

      try {
        // 从 to 参数判断 chatType
        const chatType = to?.startsWith("user:") ? "p2p" : "chat";

        // Support mediaPath/filePath/mediaUrl aliases for better CLI compatibility.
        const rawMediaPath = mediaPath || filePath || mediaUrl;

        if (!rawMediaPath) {
          throw new Error(
            `mediaPath, filePath, or mediaUrl is required. Received: ${JSON.stringify({
              to,
              mediaPath,
              filePath,
              mediaUrl,
            })}`
          );
        }

        log?.debug?.(`[WPS] outbound sendMedia - to=${to}, chatType=${chatType}, mediaPath=${rawMediaPath}`);

        // Default to image type if not specified
        const mediaType = providedMediaType || "image";
        const result = await sendMedia(completeConfig, to, rawMediaPath, mediaType as any, chatType, { log });

        if (!result.ok) {
          throw new Error(result.error || "sendMedia failed");
        }

        return {
          channel: "wps-xiezuo",
          messageId: result.messageId || undefined,
        };
      } catch (err: any) {
        log?.error?.(`[WPS] outbound sendMedia error: ${err.message}`);
        throw new Error(`sendMedia failed: ${err.message}`, { cause: err });
      }
    },
  },
  gateway: {
    startAccount: startSimpleXiezuoAccount,
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) => {
      return accounts.flatMap((account) => {
        if (!account.configured) {
          return [
            {
              channel: "wps-xiezuo",
              accountId: account.accountId,
              kind: "config" as const,
              message: "账号未配置（缺少appId或secretKey）",
            },
          ];
        }
        return [];
      });
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot?.configured ?? false,
      running: snapshot?.running ?? false,
      lastStartAt: snapshot?.lastStartAt ?? null,
      lastStopAt: snapshot?.lastStopAt ?? null,
      lastError: snapshot?.lastError ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      if (!account.configured || !account.config?.appId || !account.config?.secretKey) {
        return { ok: false, error: "未配置" };
      }
      try {
        const controller = new AbortController();
        const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
        try {
          // 测试获取token
          const client = new WPSClient(
            account.config.appId,
            account.config.secretKey,
            account.config.apiUrl || "https://openapi.wps.cn"
          );
          await client.testConnection();
          return { ok: true, details: { appId: account.config.appId } };
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (error: any) {
        return { ok: false, error: error.message };
      }
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        appId: account.config?.appId ?? null,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
      };
    },
  },
};


/**
 * 处理WPS消息（在gateway中调用）
 */
export async function handleWpsMessage(params: {
  cfg: OpenClawConfig;
  accountId: string;
  event: WPSEvent;
  log?: any;
}): Promise<void> {
  const { cfg, accountId, event, log } = params;
  const rt = getWpsXiezuoRuntime();

  // 保存日志器
  setCurrentLogger(log);

  log?.debug?.("[WPS] 接收到消息:", JSON.stringify(event));

  // 1. 消息去重
  const messageId = event.message?.id;
  if (messageId) {
    const dedupKey = `${accountId}:${messageId}`;

    if (isMessageProcessed(dedupKey)) {
      log?.debug?.(`[WPS] 跳过重复消息: ${dedupKey}`);
      return;
    }

    if (processingMessageKeys.has(dedupKey)) {
      log?.debug?.(`[WPS] 跳过处理中的重复消息: ${dedupKey}`);
      return;
    }

    processingMessageKeys.add(dedupKey);
    markMessageProcessed(dedupKey);

    // 延迟清理
    setTimeout(() => {
      processingMessageKeys.delete(dedupKey);
    }, 5000);
  }

  // 2. 解析消息
  let parsed: ParsedMessage;
  try {
    parsed = parseWPSMessage(event);
  } catch (error) {
    log?.error?.(`[WPS] 消息解析失败: ${error}`);
    return;
  }

  log?.debug?.(`[WPS] 消息解析结果 - parsed:`, JSON.stringify(parsed, null, 2));
  log?.debug?.(`[WPS] 消息解析结果 - chatType=${parsed.chatType}, chatId=${parsed.chatId}, senderId=${parsed.senderId}, isAtBot=${parsed.isAtBot}, messageId=${parsed.messageId}`);

  const config = getConfig(cfg, accountId);

  // 3. 检查群聊是否需要@机器人
  if (parsed.chatType === "group" && config.requireMention !== false && !parsed.isAtBot) {
    log?.debug?.("[WPS] 群消息未@机器人，忽略");
    return;
  }

  // 4. 权限检查（私聊）
  if (parsed.chatType === "p2p") {
    const dmPolicy = config.dmPolicy || "open";
    const allowFrom = config.allowFrom || [];

    if (dmPolicy === "allowlist") {
      const normalizedAllowFrom = normalizeAllowFrom(allowFrom);
      const isAllowed = isSenderAllowed({ allow: normalizedAllowFrom, senderId: parsed.senderId });

      if (!isAllowed) {
        log?.debug?.(`[WPS] 私聊被阻止: senderId=${parsed.senderId} 不在白名单中`);
        // 这里可以发送拒绝消息
        return;
      }
    }
  }

  // 5. 权限检查（群聊）
  if (parsed.chatType === "group") {
    const groupPolicy = config.groupPolicy || "open";
    const allowFrom = config.allowFrom || [];

    if (groupPolicy === "allowlist") {
      const normalizedAllowFrom = normalizeAllowFrom(allowFrom);
      const isAllowed = isSenderGroupAllowed({ allow: normalizedAllowFrom, groupId: parsed.chatId });

      if (!isAllowed) {
        log?.debug?.(`[WPS] 群聊被阻止: chatId=${parsed.chatId} 不在白名单中`);
        return;
      }
    }
  }

  // 6. 路由到正确的agent
  const isDirect = parsed.chatType === "p2p";
  const route = rt.channel.routing.resolveAgentRoute({
    cfg,
    channel: "wps-xiezuo",
    accountId,
    peer: { kind: isDirect ? "direct" : "group", id: isDirect ? parsed.senderId : parsed.chatId },
  });

  // 创建WPS客户端（复用）
  const client = new WPSClient(
    config.appId!,
    config.secretKey!,
    config.apiUrl || "https://openapi.wps.cn"
  );

  log?.debug?.(`[WPS] 路由和客户端创建完成 - isDirect=${isDirect}, route.agentId=${route.agentId}, route.sessionKey=${route.sessionKey}`);

  // 6.5 解析 wps-storage 格式的媒体URL（如果有）
  let resolvedMediaUrl: string | undefined = parsed.mediaUrls?.[0];
  if (parsed.mediaUrls && parsed.mediaUrls.length > 0 && parsed.mediaUrls[0].startsWith("wps-storage:")) {
    try {
      const storageKey = parsed.mediaUrls[0].replace("wps-storage:", "");
      // 调用新的API，需要 chatId 和 messageId
      const downloadUrl = await client.getDownloadUrl(parsed.chatId, messageId!, storageKey);
      resolvedMediaUrl = downloadUrl;

      log?.debug?.(`[WPS] 已解析图片URL: ${resolvedMediaUrl}`);
    } catch (err: any) {
      log?.warn?.(`[WPS] 获取图片URL失败: ${err.message}`);
      resolvedMediaUrl = undefined;
    }
  }

  const storePath = rt.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });

  const previousTimestamp = rt.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const fromLabel = isDirect
    ? `${parsed.senderId} (私聊)`
    : `群聊 ${parsed.chatId} - ${parsed.senderId}`;

  const body = rt.channel.reply.formatInboundEnvelope({
    channel: "WPS",
    from: fromLabel,
    timestamp: event.send_time,
    body: parsed.text,
    chatType: isDirect ? "direct" : "group",
    sender: { id: parsed.senderId },
    previousTimestamp,
    envelope: rt.channel.reply.resolveEnvelopeFormatOptions(cfg),
  });

  const to = isDirect ? parsed.senderId : parsed.chatId;
  const ctx = rt.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: parsed.text,
    CommandBody: parsed.text,
    From: to,
    To: to,
    SessionKey: route.sessionKey,
    AccountId: accountId,
    ChatType: isDirect ? "direct" : "group",
    ConversationLabel: fromLabel,
    GroupSubject: isDirect ? undefined : `群聊 ${parsed.chatId}`,
    SenderName: parsed.senderId,
    SenderId: parsed.senderId,
    Provider: "wps-xiezuo",
    Surface: "wps-xiezuo",
    MessageSid: messageId,
    Timestamp: event.send_time,
    MediaPath: resolvedMediaUrl,
    MediaUrl: resolvedMediaUrl,
    GroupSystemPrompt: config.groupSystemPrompt,
    GroupChannel: isDirect ? undefined : route.sessionKey,
    CommandAuthorized: true,
    OriginatingChannel: "wps-xiezuo",
    OriginatingTo: to,
  });

  await rt.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctx.SessionKey || route.sessionKey,
    ctx,
    updateLastRoute: { sessionKey: route.mainSessionKey, channel: "wps-xiezuo", to, accountId },
    onRecordError: (err: unknown) => {
      log?.error?.(`[WPS] 记录会话失败: ${String(err)}`);
    },
  });

  log?.info?.(`[WPS] 接收消息: from=${fromLabel} text="${parsed.text.slice(0, 50)}..."`);
  log?.info?.(`[WPS] 消息解析结果 - chatType=${parsed.chatType}, chatId=${parsed.chatId}, senderId=${parsed.senderId}, isAtBot=${parsed.isAtBot}, messageId=${parsed.messageId}`);

  // 7. 发送"思考中"提示（如果启用）
  if (config.showThinking !== false) {
    try {
      // 单聊时使用 senderId，群聊时使用 chatId
      const targetId = parsed.chatType === "p2p" ? parsed.senderId : parsed.chatId;
      log?.debug?.(`[WPS] 准备发送思考提示 - chatType=${parsed.chatType}, targetId=${targetId}, senderId=${parsed.senderId}, chatId=${parsed.chatId}`);
      await client.sendTextMessage("🤔 思考中，请稍候...", targetId, parsed.chatType, undefined, "plain");
      log?.debug?.(`[WPS] 思考提示发送成功`);
    } catch (err: any) {
      log?.warn?.(`[WPS] 思考提示发送失败: ${err.message}`);
      log?.debug?.(`[WPS] ParsedMessage详情: chatType=${parsed.chatType}, chatId=${parsed.chatId}, senderId=${parsed.senderId}, isAtBot=${parsed.isAtBot}`);
    }
  }

  // 8. 调用AI回复
  const { queuedFinal } = await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    cfg,
    dispatcherOptions: {
      responsePrefix: "",
      deliver: async (payload) => {
        // 打印ParsedMessage关键信息用于debug
        log?.debug?.(`[WPS] 准备发送回复消息`);
        log?.debug?.(`[WPS] ParsedMessage详情: chatType=${parsed.chatType}, chatId=${parsed.chatId}, senderId=${parsed.senderId}, isAtBot=${parsed.isAtBot}, messageId=${parsed.messageId}`);

        try {
          // 单聊时使用 senderId，群聊时使用 chatId
          const targetId = parsed.chatType === "p2p" ? parsed.senderId : parsed.chatId;

          // 智能消息类型判断
          // 优先级：channelData.messageType > mediaUrls > text

          // 1. 检查 channelData.messageType（Agent 可以通过这个字段精确控制）
          const messageType = payload.channelData?.messageType as string;

          if (messageType === "image" && payload.mediaUrl) {
            // 发送图片消息
            log?.debug?.(`[WPS] 检测到图片消息类型 - mediaUrl=${payload.mediaUrl}`);
            await client.sendImageMessage(payload.mediaUrl, targetId, parsed.chatType);
            log?.debug?.(`[WPS] 图片消息发送成功`);
            return;
          } else if (messageType === "file" && payload.mediaUrl) {
            // 发送文件消息
            const fileName = extractFileNameFromUrl(payload.mediaUrl);
            log?.debug?.(`[WPS] 检测到文件消息类型 - fileName=${fileName}`);
            await client.sendFileMessage(payload.mediaUrl, targetId, parsed.chatType, fileName);
            log?.debug?.(`[WPS] 文件消息发送成功`);
            return;
          } else if (messageType === "rich_text" && payload.text) {
            // 发送富文本消息
            const elements = parseTextToRichTextElements(payload.text);
            log?.debug?.(`[WPS] 发送富文本消息 - 元素数量=${elements.length}`);
            await client.sendRichTextMessage(elements, targetId, parsed.chatType);
            log?.debug?.(`[WPS] 富文本消息发送成功`);
            return;
          }

          // 2. 检查 mediaUrls（Agent 提供的媒体URL列表）
          if (payload.mediaUrls && payload.mediaUrls.length > 0) {
            if (payload.mediaUrls.length === 1) {
              // 单个媒体，尝试发送为图片消息
              try {
                log?.debug?.(`[WPS] 发送单个图片 - url=${payload.mediaUrls[0]}`);
                await client.sendImageMessage(payload.mediaUrls[0], targetId, parsed.chatType);
                log?.debug?.(`[WPS] 单个图片消息发送成功`);
              } catch (err) {
                // 降级为文本消息
                log?.debug?.(`[WPS] 单个图片消息发送失败，降级为文本: ${payload.mediaUrls[0]}`);
                await client.sendTextMessage(payload.text || payload.mediaUrls[0], targetId, parsed.chatType);
                log?.debug?.(`[WPS] 降级文本消息发送成功`);
              }
            } else {
              // 多个媒体，使用富文本消息
              const elements = payload.mediaUrls.map((url, i) => {
                return {
                  type: "image",
                  alt_text: `[图片${i + 1}]`,
                  indent: 0,
                  index: i,
                  elements: [{
                    type: "image",
                    alt_text: `[图片${i + 1}]`,
                    indent: 0,
                    index: 0,
                    image_content: {
                      storage_key: url,
                    },
                  }],
                };
              });

              // 添加文本（如果有）
              if (payload.text) {
                elements.push({
                  type: "text",
                  alt_text: payload.text,
                  indent: 0,
                  index: payload.mediaUrls.length,
                  elements: [{
                    type: "text",
                    alt_text: payload.text,
                    indent: 0,
                    index: 0,
                    text_content: {
                      content: payload.text,
                      type: "plain",
                    },
                  }],
                });
              }

              log?.debug?.(`[WPS] 发送多个图片（富文本） - 图片数量=${payload.mediaUrls.length}`);
              await client.sendRichTextMessage(elements, targetId, parsed.chatType);
              log?.debug?.(`[WPS] 多个图片消息发送成功`);
            }
            return;
          }

          // 3. 检查 mediaUrl（单个媒体URL）
          if (payload.mediaUrl) {
            try {
              log?.debug?.(`[WPS] 发送单图片消息 - mediaUrl=${payload.mediaUrl}`);
              await client.sendImageMessage(payload.mediaUrl, targetId, parsed.chatType);
              log?.debug?.(`[WPS] 单图片消息发送成功`);
            } catch (err) {
              // 降级为文本消息
              log?.debug?.(`[WPS] 单图片消息发送失败，降级为文本: ${payload.mediaUrl}`);
              await client.sendTextMessage(payload.text || payload.mediaUrl, targetId, parsed.chatType);
              log?.debug?.(`[WPS] 降级文本消息发送成功`);
            }
            log?.debug?.(`[WPS] 单图片消息处理完成`);
            return;
          }

          // 4. 默认发送文本消息
          if (payload.text) {
            log?.debug?.(`[WPS] 发送纯文本消息 - 内容长度=${payload.text.length}`);
            await client.sendTextMessage(payload.text, targetId, parsed.chatType, undefined, "markdown");
            log?.debug?.(`[WPS] 纯文本消息发送成功`);
          }
        } catch (err: any) {
          log?.error?.(`[WPS] 回复失败: ${err.message}`);
          throw err;
        }
      },
    },
    replyOptions: {},
  });
}

export const wpsXiezuoPlugin = simpleXiezuoPlugin;

/**
 * 从URL中提取文件名
 */
function extractFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const parts = path.split("/");
    const fileName = parts[parts.length - 1];
    return fileName.split("?")[0] || "文件";
  } catch {
    return url.substring(url.lastIndexOf("/") + 1) || "文件";
  }
}

/**
 * 解析文本为富文本元素（简单实现）
 */
function parseTextToRichTextElements(text: string): Array<{
  type: string;
  alt_text: string;
  indent: number;
  index: number;
  elements: Array<{
    type: string;
    alt_text: string;
    indent: number;
    index: number;
    text_content: { content: string; type: string };
  }>;
}> {
  return [{
    type: "text",
    alt_text: text,
    indent: 0,
    index: 0,
    elements: [{
      type: "text",
      alt_text: text,
      indent: 0,
      index: 0,
      text_content: {
        content: text,
        type: "plain",
      },
    }],
  }];
}

export { detectMediaTypeFromExtension } from "./media-utils.js";

