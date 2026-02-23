import type { WPSEvent } from "./message-parser.js";

/**
 * 消息内容类型
 */
export interface MessageContent {
  text: string;
  mediaPath?: string;
  mediaUrls?: string[];
  mentions?: Array<{ id: string; name?: string }>;
}

/**
 * 从WPS事件中提取消息内容
 */
export function extractMessageContent(event: WPSEvent): MessageContent {
  return {
    text: event.message?.content?.text?.content || "",
    mentions: event.message?.mentions?.map(m => ({
      id: m.identity?.id || "",
      name: m.identity?.name || undefined,
    })) || [],
  };
}

/**
 * 格化组成员列表
 */
export function formatGroupMembers(
  members: Array<{ id: string; name?: string }>
): string | undefined {
  if (members.length === 0) {
    return undefined;
  }

  const memberList = members
    .map(m => m.name ? `${m.name} (${m.id})` : m.id)
    .join(", ");

  return `群成员: ${memberList}`;
}

/**
 * 检查是否@了机器人
 */
export function isMentionBot(mentions: Array<{ id: string; name?: string }> | undefined): boolean {
  if (!mentions || mentions.length === 0) {
    return false;
  }

  return mentions.some(m => m.id.includes("app"));
}