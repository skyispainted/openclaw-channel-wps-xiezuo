import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { WpsXiezuoChannelConfig, WpsXiezuoAccountConfig } from "./types.js";

/**
 * 从OpenClaw配置中获取WPS配置
 */
export function getConfig(cfg: OpenClawConfig, accountId?: string | null): WpsXiezuoAccountConfig {
  const base = cfg.channels?.["wps-xiezuo"] as WpsXiezuoChannelConfig | undefined;
  if (!base) {
    return {} as any;
  }

  const id = accountId || DEFAULT_ACCOUNT_ID;
  const account = base.accounts?.[id];

  // 合并基础配置和账号配置
  return {
    ...base,
    ...(account || {}),
    name: account?.name || base.name,
  };
}

/**
 * 检查WPS是否已配置
 */
export function isConfigured(cfg: OpenClawConfig): boolean {
  const config = getConfig(cfg);
  return Boolean(config.appId && config.secretKey);
}

/**
 * 列出所有账号ID
 */
export function listWpsXiezuoAccountIds(cfg: OpenClawConfig): string[] {
  const config = cfg.channels?.["wps-xiezuo"] as WpsXiezuoChannelConfig | undefined;
  if (!config?.accounts) {
    return [];
  }

  return Object.keys(config.accounts).filter((id) => {
    const account = config.accounts?.[id];
    return Boolean(account?.appId && account?.secretKey);
  });
}

/**
 * 解析账号配置
 */
export function resolveWpsXiezuoAccount(cfg: OpenClawConfig, accountId?: string | null): WpsXiezuoAccountConfig {
  const config = getConfig(cfg, accountId);
  const id = accountId || DEFAULT_ACCOUNT_ID;

  return {
    ...config,
    enabled: config.enabled !== false,
  };
}

/**
 * 获取当前时间戳（ISO格式）
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}