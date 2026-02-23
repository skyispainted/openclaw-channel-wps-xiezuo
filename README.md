# WPS Xiezuo Channel for OpenClaw

<div align="center">

> [!WARNING]
> **Experimental Version / 开发测试版**
> 
> This plugin is currently in the **Alpha/Active Development** stage. 
> - ⚠️ **Stability:** Core logic (signature verification, message decryption) is still undergoing integration testing.
> - ⚠️ **Production Use:** Not recommended for production environments yet.
> - 🛠️ **Contributions:** If you encounter issues or have tested it successfully, please [open an Issue](https://github.com/skyispainted/openclaw-channel-wps-xiezuo/issues).
>
> 本插件目前处于 **开发/测试 (Alpha)** 阶段。
> - ⚠️ **稳定性：** 核心逻辑（签名验证、消息解密等）尚未完成完整的全链路集成测试。
> - ⚠️ **生产环境：** 暂不建议在正式生产环境或重要业务场景中使用。
> - 🛠️ **贡献：** 如果你在使用中遇到 Bug 或测试成功，欢迎提交 Issue。

---

**WPS Xiezuo (WPS 365) Enterprise Bot Channel Plugin for OpenClaw**

[English](README.md) | [中文](README-cn.md)

</div>

---

An enterprise bot channel plugin for **WPS Xiezuo (WPS 365)**, utilizing the HTTP Callback (Webhook) mode for seamless message synchronization.

## Acknowledgments

This project is a refactored adaptation of the [`simple-xiezuo`](https://github.com/xieqiwen/simple-xiezuo) project by [@xieqiwen](https://github.com/xieqiwen). We extend our gratitude for their foundational work.

## Features

- ✅ **HTTP Callback Mode** — Receives messages via Webhook (requires public network accessibility).
- ✅ **Direct Message (DM) Support** — Direct 1-on-1 interaction with the bot.
- ✅ **Group Chat Support** — Interaction via @mentions in group channels.
- ✅ **OpenClaw Pipeline Integration** — Fully compatible with the OpenClaw AI message processing engine.

## Installation

### Method A: Via npm (Recommended for users)

*Note: This package is pending official registry publication.*

```bash
openclaw plugins install @skyispainted/wps-xiezuo
```

### Method B: Via Local Source (Recommended for developers)

If you intend to modify the plugin or contribute:

```bash
# 1. Clone the repository
git clone https://github.com/skyispainted/openclaw-channel-wps-xiezuo.git
cd openclaw-channel-wps-xiezuo

# 2. Install dependencies
npm install

# 3. Install in Link Mode (changes reflect instantly)
openclaw plugins install -l .
```

### Method C: Manual Installation

1. Copy the directory to `~/.openclaw/extensions/wps-xiezuo`.
2. Ensure `index.ts`, `openclaw.plugin.json`, and `package.json` are present.
3. Verify the installation: `openclaw plugins list`.

---

### Mandatory Step: Plugin Trust Whitelist (`plugins.allow`)

To ensure security, OpenClaw requires explicit authorization for non-bundled plugins. If `plugins.allow` is empty, you will see a security warning.

#### 1. Confirm Plugin ID

The default ID for this plugin is `wps-xiezuo` (defined in `openclaw.plugin.json`).

#### 2. Update `~/.openclaw/openclaw.json`

Add the ID to the `allow` array:

```json5
{
  "plugins": {
    "enabled": true,
    "allow": ["wps-xiezuo"]
  }
}
```

#### 3. Restart Gateway

```bash
openclaw gateway restart
```

## Updates

For npm-based installations:

```bash
openclaw plugins update wps-xiezuo
```

For local/link installations, pull the latest code and restart the gateway:

```bash
git pull
openclaw gateway restart
```

## Configuration

### Method 1: Interactive CLI (Recommended)

OpenClaw provides a guided setup wizard:

```bash
# Option A: Full onboarding
openclaw onboard

# Option B: Target specific section
openclaw configure --section channels
```

**Configuration Flow:**

1. **Select Plugin:** Choose `wps-xiezuo` or `WPS Xiezuo`.
2. **App ID:** Enter your WPS AppId.
3. **Secret Key:** Enter your WPS SecretKey.
4. **Encrypt Key:** Enter your WPS EncryptKey.
5. **API URL:** Default is `https://openapi.wps.cn/v7/`.
6. **Callback URL:** Your public-facing Webhook URL.
7. **Policies:** Set DM and Group policies (`open` or `allowlist`).

---

#### WPS Developer Platform Setup Guide

1. **Create Application:** Visit the [WPS Open Platform](https://open.wps.cn/) and create an Internal Enterprise App.
2. **Message Mode:** Set to **HTTP Callback Mode**.
3. **Retrieve Credentials:** Copy the **App ID**, **Secret Key**, and **Encrypt Key** from the dashboard.
4. **Configure Callback:** Set the Event Subscription URL to:
`http://<YOUR_PUBLIC_IP>:<PORT>/wps-xiezuo/callback`

---

### Method 2: Manual Configuration

Edit `~/.openclaw/openclaw.json` directly:

```json5
{
  "channels": {
    "wps-xiezuo": {
      "enabled": true,
      "appId": "your-app-id",
      "secretKey": "your-secret-key",
      "encryptKey": "your-encrypt-key",
      "apiUrl": "https://openapi.wps.cn/v7/",
      "dmPolicy": "open",
      "groupPolicy": "open",
      "debug": false
    }
  }
}
```

## Configuration Schema

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Enables/Disables the channel. |
| `appId` | string | **Required** | WPS Application AppId. |
| `secretKey` | string | **Required** | WPS Application SecretKey. |
| `encryptKey` | string | **Required** | AES Encryption Key for messages. |
| `apiUrl` | string | `https://openapi.wps.cn/v7/` | WPS OpenAPI endpoint. |
| `dmPolicy` | string | `"open"` | Private chat policy: `open` or `allowlist`. |
| `groupPolicy` | string | `"open"` | Group chat policy: `open` or `allowlist`. |
| `allowFrom` | string[] | `[]` | List of authorized User IDs (for `allowlist`). |
| `debug` | boolean | `false` | Enables verbose logging for troubleshooting. |

## Security & Policies

### DM Policy

* `open`: Any user within the enterprise can message the bot.
* `allowlist`: Only users listed in `allowFrom` can interact.

### Group Policy

* `open`: The bot responds to @mentions in any group it is added to.
* `allowlist`: The bot only responds in specific authorized groups.

## Troubleshooting

* **No Response:** Verify the app is "Published" in the WPS console and your server port is open to the internet.
* **Encryption Errors:** Ensure the `encryptKey` matches the WPS console exactly (usually 16, 24, or 32 bytes).
* **Auth Failure:** Check if the `appId` or `secretKey` has been reset or if the app has been disabled.
* **Logs:** Run `openclaw logs | grep wps-xiezuo` for real-time debugging.

---
