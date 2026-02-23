import type { OpenClawConfig, ChannelOnboardingAdapter, WizardPrompter } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";
import { listWpsXiezuoAccountIds, resolveWpsXiezuoAccount } from "./utils.js";

const channel = "wps-xiezuo" as const;

function isConfigured(account: any): boolean {
  return Boolean(account.appId && account.secretKey);
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptWpsXiezuoAccountId(options: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
  label: string;
  currentId: string;
  listAccountIds: (cfg: OpenClawConfig) => string[];
  defaultAccountId: string;
}): Promise<string> {
  const existingIds = options.listAccountIds(options.cfg);
  if (existingIds.length === 0) {
    return options.defaultAccountId;
  }
  const useExisting = await options.prompter.confirm({
    message: `使用现有的 ${options.label} 账号?`,
    initialValue: true,
  });
  if (useExisting && existingIds.includes(options.currentId)) {
    return options.currentId;
  }
  const newId = await options.prompter.text({
    message: `新的 ${options.label} 账号ID`,
    placeholder: options.defaultAccountId,
    initialValue: options.defaultAccountId,
  });
  return normalizeAccountId(String(newId));
}

async function noteWpsHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "您需要WPS协作应用凭证。",
      "1. 访问 https://open.wps.cn/",
      "2. 创建企业内部应用",
      "3. 配置机器人能力",
      "4. 获取 App ID、Secret Key 和 Encrypt Key",
      "5. 配置回调URL（HTTP模式）",
    ].join("\n"),
    "WPS协作设置"
  );
}

function applyAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  input: Partial<any>;
}): OpenClawConfig {
  const { cfg, accountId, input } = params;
  const useDefault = accountId === DEFAULT_ACCOUNT_ID;

  const base = cfg.channels?.[channel] as any | undefined;

  const payload: Partial<any> = {
    ...(input.appId ? { appId: input.appId } : {}),
    ...(input.secretKey ? { secretKey: input.secretKey } : {}),
    ...(input.encryptKey ? { encryptKey: input.encryptKey } : {}),
    ...(input.apiUrl ? { apiUrl: input.apiUrl } : {}),
    ...(input.companyId ? { companyId: input.companyId } : {}),
    ...(input.dmPolicy ? { dmPolicy: input.dmPolicy } : {}),
    ...(input.groupPolicy ? { groupPolicy: input.groupPolicy } : {}),
    ...(input.allowFrom && input.allowFrom.length > 0 ? { allowFrom: input.allowFrom } : {}),
  };

  if (useDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        [channel]: {
          ...base,
          enabled: true,
          ...payload,
        },
      },
    };
  }

  const accounts = base?.accounts ?? {};
  const existingAccount = base?.accounts?.[accountId] ?? {};

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [channel]: {
        ...base,
        enabled: base?.enabled ?? true,
        accounts: {
          ...accounts,
          [accountId]: {
            ...existingAccount,
            enabled: true,
            ...payload,
          },
        },
      },
    },
  };
}

export const wpsXiezuoOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: ({ cfg }) => {
    const accountIds = listWpsXiezuoAccountIds(cfg);
    const configured =
      accountIds.length > 0
        ? accountIds.some((accountId) => isConfigured(resolveWpsXiezuoAccount(cfg, accountId)))
        : isConfigured(resolveWpsXiezuoAccount(cfg, DEFAULT_ACCOUNT_ID));

    return Promise.resolve({
      channel,
      configured,
      statusLines: [`WPS协作: ${configured ? "已配置" : "需要设置"}`],
      selectionHint: configured ? "已配置" : "WPS协作",
      quickstartScore: configured ? 1 : 4,
    });
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = accountOverrides[channel]?.trim();
    let accountId = override ? normalizeAccountId(override) : DEFAULT_ACCOUNT_ID;

    if (shouldPromptAccountIds && !override) {
      accountId = await promptWpsXiezuoAccountId({
        cfg,
        prompter,
        label: "WPS协作",
        currentId: accountId,
        listAccountIds: listWpsXiezuoAccountIds,
        defaultAccountId: DEFAULT_ACCOUNT_ID,
      });
    }

    const resolved = resolveWpsXiezuoAccount(cfg, accountId);
    await noteWpsHelp(prompter);

    const appId = await prompter.text({
      message: "App ID",
      placeholder: "your-app-id",
      initialValue: resolved.appId ?? undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "必填"),
    });

    const secretKey = await prompter.text({
      message: "Secret Key",
      placeholder: "your-secret-key",
      initialValue: resolved.secretKey ?? undefined,
      validate: (value) => (String(value ?? "").trim() ? undefined : "必填"),
    });

    const encryptKey = await prompter.text({
      message: "Encrypt Key",
      placeholder: "your-encrypt-key",
      initialValue: resolved.encryptKey ?? undefined,
    });

    const dmPolicyValue = await prompter.select({
      message: "私聊策略",
      options: [
        { label: "开放 - 任何人都可以私聊", value: "open" },
        { label: "白名单 - 仅允许的用户", value: "allowlist" },
      ],
      initialValue: resolved.dmPolicy ?? "open",
    });

    let allowFrom: string[] | undefined;
    if (dmPolicyValue === "allowlist") {
      const entry = await prompter.text({
        message: "允许的用户ID（逗号分隔）",
        placeholder: "user1, user2",
      });
      const parsed = parseList(String(entry ?? ""));
      allowFrom = parsed.length > 0 ? parsed : undefined;
    }

    const next = applyAccountConfig({
      cfg,
      accountId,
      input: {
        appId: String(appId).trim(),
        secretKey: String(secretKey).trim(),
        encryptKey: encryptKey ? String(encryptKey).trim() : undefined,
        dmPolicy: dmPolicyValue as "open" | "allowlist",
        allowFrom,
      },
    });

    return { cfg: next, accountId };
  },
};