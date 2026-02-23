import { createHash } from "node:crypto";

/**
 * WPS OAuth Access Token管理器
 */

interface TokenCache {
  token: string;
  expiresAt: number;
}

/**
 * 生成安全的缓存键（避免密钥泄露）
 */
function generateCacheKey(appId: string, appSecret: string): string {
  return createHash("sha256").update(`${appId}:${appSecret}`).digest("hex").slice(0, 32);
}

class OAuthTokenManager {
  private cache = new Map<string, TokenCache>();
  private requesting = new Map<string, Promise<string>>();

  async getAccessToken(
    appId: string,
    appSecret: string,
    apiUrl: string
  ): Promise<string> {
    const cacheKey = generateCacheKey(appId, appSecret);

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    const existing = this.requesting.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = this.fetchAccessToken(appId, appSecret, apiUrl, cacheKey);
    this.requesting.set(cacheKey, promise);

    try {
      const token = await promise;
      return token;
    } finally {
      this.requesting.delete(cacheKey);
    }
  }

  private async fetchAccessToken(
    appId: string,
    appSecret: string,
    apiUrl: string,
    cacheKey: string
  ): Promise<string> {
    const url = `${apiUrl}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: appId,
      client_secret: appSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取access_token失败 ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;

    if (!result.access_token) {
      throw new Error("access_token响应无效");
    }

    const expiresIn = result.expires_in || 7200;
    this.cache.set(cacheKey, {
      token: result.access_token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    });

    return result.access_token;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const oauthTokenManager = new OAuthTokenManager();
