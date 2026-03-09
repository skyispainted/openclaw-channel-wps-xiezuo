import { companyTokenManager } from "./company-token.js";
import { oauthTokenManager } from "./oauth-token.js";
import { calculateWPS3Signature, calculateContentMd5, getRFC1123Date, generateKSO1AuthHeader } from "./crypto.js";

/**
 * @用户配置
 */
export interface Mention {
  /** @标记的索引ID，对应消息内容中的 <at id={index}> */
  id: string;
  /** @类型: user=特定用户, all=全体成员 */
  type: "user" | "all";
  /** 用户ID（当type="user"时必填） */
  userId?: string;
  /** 用户名称（当type="user"时必填） */
  userName?: string;
  /** 企业ID（可选） */
  companyId?: string;
}

/**
 * 构建mentions数组
 */
function buildMentions(mentions?: Mention[]): any[] | undefined {
  if (!mentions || mentions.length === 0) {
    return undefined;
  }

  return mentions.map(m => {
    if (m.type === "all") {
      // @所有人
      return {
        id: m.id,
        type: "all",
      };
    }

    // @特定用户
    return {
      id: m.id,
      identity: {
        id: m.userId,
        name: m.userName,
        type: "user" as const,
        ...(m.companyId ? { company_id: m.companyId } : {}),
      },
      type: "user" as const,
    };
  });
}

export interface WPSResponse {
  result: number;
  msg?: string;
  message_id?: string;
}
