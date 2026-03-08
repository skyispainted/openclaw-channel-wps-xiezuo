import { autoFetchCompanyId } from "./auto-config.js";

/**
 * CompanyId 缓存管理器
 * 用于缓存已获取的 companyId，避免重复请求
 */
export interface CompanyIdCache {
  [accountId: string]: {
    companyId: string;
    appId: string;  // 用于验证缓存有效性
    fetchedAt: number;
  };
}

// 内存缓存
const companyIdCache: CompanyIdCache = {};

/**
 * 获取缓存的 companyId
 *
 * @param accountId 账号ID
 * @param appId 当前应用ID（用于验证缓存是否有效）
 * @returns 缓存的 companyId，如果不存在或无效则返回 undefined
 */
export function getCachedCompanyId(accountId: string, appId: string): string | undefined {
  const cached = companyIdCache[accountId];
  if (!cached) {
    return undefined;
  }

  // 验证 appId 是否匹配（防止配置变更后使用错误的缓存）
  if (cached.appId !== appId) {
    return undefined;
  }

  return cached.companyId;
}

/**
 * 缓存 companyId
 *
 * @param accountId 账号ID
 * @param appId 应用ID
 * @param companyId 公司ID
 */
export function cacheCompanyId(accountId: string, appId: string, companyId: string): void {
  companyIdCache[accountId] = {
    companyId,
    appId,
    fetchedAt: Date.now(),
  };
}

/**
 * 启动时预加载 companyId
 * 如果配置中已提供，则直接使用；否则自动获取并缓存
 *
 * @param accountId 账号ID
 * @param config 配置对象
 * @param log 日志记录器
 * @returns Promise<void>
 */
export async function preloadCompanyId(
  accountId: string,
  config: any,
  log?: any
): Promise<void> {
  // 如果配置中已提供 companyId，直接缓存
  if (config.companyId) {
    cacheCompanyId(accountId, config.appId, config.companyId);
    log?.debug?.(`[${accountId}] 使用配置的 companyId: ${config.companyId}`);
    return;
  }

  // 否则自动获取
  try {
    log?.info?.(`[${accountId}] 正在预获取 companyId...`);
    const companyId = await autoFetchCompanyId(
      config.appId,
      config.secretKey,
      config.apiUrl || "https://openapi.wps.cn"
    );

    cacheCompanyId(accountId, config.appId, companyId);
    log?.info?.(`[${accountId}] ✅ 预获取 companyId: ${companyId}`);
  } catch (error) {
    log?.error?.(`[${accountId}] ❌ 预获取 companyId 失败: ${error}`);
    throw error;
  }
}

/**
 * 获取完整的配置（优先使用缓存的 companyId）
 *
 * @param accountId 账号ID
 * @param config 原始配置
 * @returns 完整配置
 */
export function getCompleteConfig(accountId: string, config: any): any {
  // 如果配置中已有 companyId，直接返回
  if (config.companyId) {
    return config;
  }

  // 尝试从缓存获取
  const cachedCompanyId = getCachedCompanyId(accountId, config.appId);
  if (cachedCompanyId) {
    return {
      ...config,
      companyId: cachedCompanyId,
    };
  }

  // 缓存未命中（理论上不应该发生，因为启动时已预加载）
  throw new Error(
    `companyId 未配置且缓存未命中，请检查启动流程是否正确调用 preloadCompanyId`
  );
}
