import { createHash } from "node:crypto";
import { calculateWPS3Signature, calculateContentMd5, getRFC1123Date } from "./crypto.js";

interface TokenCacheItem {
  token: string;
  expiresAt: number;
}

/**
 * 生成安全的缓存键（避免密钥泄露）
 */
function generateCacheKey(appId: string, secretKey: string): string {
  return createHash("sha256").update(`${appId}:${secretKey}`).digest("hex").slice(0, 32);
}

class CompanyTokenManager {
  private cache = new Map<string, TokenCacheItem>();

  async getCompanyToken(
    appId: string,
    secretKey: string,
    apiUrl: string
  ): Promise<string> {
    const cacheKey = generateCacheKey(appId, secretKey);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.token;
    }

    const token = await this.fetchCompanyToken(appId, secretKey, apiUrl);
    
    this.cache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });

    return token;
  }

  private async fetchCompanyToken(
    appId: string,
    secretKey: string,
    apiUrl: string
  ): Promise<string> {
    const path = `/oauthapi/v3/inner/company/token?app_id=${appId}`;
    const url = `${apiUrl}${path}`;
    
    const date = getRFC1123Date();
    const contentType = "application/json";
    const contentMd5 = calculateContentMd5("");

    const signature = calculateWPS3Signature(
      appId,
      secretKey,
      contentMd5,
      path,
      contentType,
      date
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": contentType,
        "Content-MD5": contentMd5,
        "Date": date,
        "X-Auth": signature,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取Company Token失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as any;
    
    if (!result.company_token) {
      throw new Error("响应中没有company_token");
    }

    return result.company_token;
  }

  clearCache(appId: string, secretKey: string) {
    const cacheKey = generateCacheKey(appId, secretKey);
    this.cache.delete(cacheKey);
  }

  clearAllCache() {
    this.cache.clear();
  }
}

export const companyTokenManager = new CompanyTokenManager();
