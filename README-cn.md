# WPS 协作 Channel for OpenClaw

<div align="center">

> [!WARNING]
> **开发测试版 / Alpha 阶段**
>
> 本插件目前处于 **开发/测试 (Alpha)** 阶段。
> - ⚠️ **稳定性：** 核心逻辑（签名验证、消息解密等）尚未完成完整的全链路集成测试。
> - ⚠️ **生产环境：** 暂不建议在正式生产环境或重要业务场景中使用。
> - 🛠️ **贡献：** 如果你在使用中遇到 Bug 或测试成功，欢迎提交 [Issue](https://github.com/skyispainted/openclaw-channel-wps-xiezuo/issues)。

---

**WPS Xiezuo (WPS 365) 企业机器人 Channel 插件**

[English](README.md) | [中文](README-cn.md)

</div>

---

本插件为 **WPS 协作 (WPS 365)** 企业内部机器人提供 Channel 支持，采用 HTTP 回调 (Webhook) 模式实现消息的无缝同步。

## 致谢

本项目基于 [@xieqiwen](https://github.com/xieqiwen) 的 [`simple-xiezuo`](https://github.com/xieqiwen/simple-xiezuo) 项目进行重构与适配。感谢其提供的基础框架支持。

## 功能特性

* ✅ **HTTP 回调模式** — 通过 Webhook 接收消息（需具备公网访问能力）。
* ✅ **支持私聊 (DM)** — 与机器人进行 1 对 1 直接交互。
* ✅ **支持群聊** — 在群组频道中通过 @机器人进行交互。
* ✅ **OpenClaw 管道集成** — 完全兼容 OpenClaw AI 消息处理引擎。
* ✅ **媒体消息支持** — 自动解析和转换 WPS-storage 媒体存储键。
* ✅ **灵活的消息类型** — Agent 可控制消息类型选择（文本、图片、文件、富文本）。

## 安装指南

### 方法 A：通过 npm 安装（推荐用户使用）

*注意：本仓库正准备发布至官方 registry。*

```bash
openclaw plugins install @skyispainted/wps-xiezuo
```

### 方法 B：通过本地源码安装（推荐开发者使用）

如果你打算修改插件或进行贡献：

```bash
# 1. 克隆仓库
git clone https://github.com/skyispainted/openclaw-channel-wps-xiezuo.git
cd openclaw-channel-wps-xiezuo

# 2. 安装依赖
npm install

# 3. 以链接模式安装（修改可实时生效）
openclaw plugins install -l .
```

### 方法 C：手动安装

1. 将目录复制到 `~/.openclaw/extensions/wps-xiezuo`。
2. 确保 `index.ts`、`openclaw.plugin.json` 和 `package.json` 文件存在。
3. 运行 `openclaw plugins list` 验证安装。

---

### 强制步骤：配置插件信任白名单 (`plugins.allow`)

为了确保安全性，OpenClaw 要求对非内置插件进行显式授权。如果 `plugins.allow` 为空，系统将触发安全告警。

#### 1. 确认插件 ID

本插件的默认 ID 为 `wps-xiezuo`（定义于 `openclaw.plugin.json`）。

#### 2. 更新 `~/.openclaw/openclaw.json`

将 ID 添加到 `allow` 数组中：

```json5
{
  "plugins": {
    "enabled": true,
    "allow": ["wps-xiezuo"]
  }
}
```

#### 3. 重启 Gateway

```bash
openclaw gateway restart
```

## 更新

对于基于 npm 安装的版本：

```bash
openclaw plugins update wps-xiezuo
```

对于本地/链接安装的版本，请拉取最新代码并重启网关：

```bash
git pull
openclaw gateway restart
```

## 配置说明

### 方法 1：交互式 CLI 配置（推荐）

OpenClaw 提供了引导式设置向导：

```bash
# 选项 A：完整入驻流程
openclaw onboard

# 选项 B：针对特定部分进行配置
openclaw configure --section channels
```

**配置流程：**

1. **选择插件:** 选择 `wps-xiezuo` 或 `WPS Xiezuo`。
2. **App ID:** 输入你的 WPS AppId。
3. **Secret Key:** 输入你的 WPS SecretKey。
4. **Encrypt Key:** 输入你的 WPS EncryptKey。
5. **API URL:** 默认值为 `https://openapi.wps.cn`。
6. **回调 URL:** 你的公网 Webhook 接收地址。
7. **策略设置:** 配置私聊和群聊策略（`open` 或 `allowlist`）。

---

#### WPS 开发者平台配置向导

1. **创建应用:** 访问 [WPS 开放平台](https://open.wps.cn/) 并创建一个企业内部应用。
2. **消息模式:** 设置为 **HTTP 回调模式**。
3. **获取凭据:** 从控制台复制 **App ID**、**Secret Key** 和 **Encrypt Key**。
4. **配置回调:** 将事件订阅 URL 设置为：
`http://<您的公网IP>:<端口>/wps-xiezuo/callback`

---

### 方法 2：手动修改配置文件

直接编辑 `~/.openclaw/openclaw.json`：

```json5
{
  "channels": {
    "wps-xiezuo": {
      "enabled": true,
      "appId": "your-app-id",
      "secretKey": "your-secret-key",
      "encryptKey": "your-encrypt-key",
      "apiUrl": "https://openapi.wps.cn",
      "dmPolicy": "open",
      "groupPolicy": "open",
      "debug": false
    }
  }
}
```

## 配置项 Schema

| 选项 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 是否启用该 Channel。 |
| `appId` | string | **必填** | WPS 应用的 AppId。 |
| `secretKey` | string | **必填** | WPS 应用的 SecretKey。 |
| `encryptKey` | string | **必填** | 用于消息解密的 AES 密钥。 |
| `apiUrl` | string | `https://openapi.wps.cn` | WPS OpenAPI 端点地址。 |
| `dmPolicy` | string | `"open"` | 私聊策略：`open` 或 `allowlist`。 |
| `groupPolicy` | string | `"open"` | 群聊策略：`open` 或 `allowlist`。 |
| `allowFrom` | string[] | `[]` | 已授权的用户 ID 列表（用于 `allowlist` 模式）。 |
| `debug` | boolean | `false` | 是否开启详细日志用于故障排查。 |

## 安全与策略

### 私聊策略 (DM Policy)

* `open`: 企业内的任何用户均可与机器人对话。
* `allowlist`: 仅 `allowFrom` 列表中的用户可以进行交互。

### 群聊策略 (Group Policy)

* `open`: 机器人在被添加进的任何群组中都会响应 @mention。
* `allowlist`: 机器人仅在特定的授权群组中响应。


---

## 媒体消息处理

WPS协作支持发送图片、文件等媒体消息。系统会自动解析这些消息中的 `storage_key` 并转换为临时可访问的URL，供AI分析使用。

**支持的消息类型：**
* **图片消息（image）**：自动解析并转换为临时下载链接
* **文件消息（file）**：本地文件自动解析，云文档直接使用链接
* **富文本消息（rich_text）**：提取其中的图片和文本内容

**注意：**
* 临时链接通常有有效期（如1小时），过期后需要重新获取
* 如果获取链接失败，AI将无法分析图片内容

---

## Agent AI 控制消息类型

OpenClaw 的 Agent 可以通过 `ReplyPayload` 精确控制发送的消息类型，无需依赖自动检测。

### 使用方式

#### 方式1：使用 mediaUrl / mediaUrls（推荐）

Agent 只需设置 `mediaUrl` 或 `mediaUrls`，系统会自动选择合适的消息类型：

```typescript
// 发送图片消息
const payload = {
  mediaUrl: "wps-storage:image_storage_key",
  text: "这是一张图片说明"  // 可选
};

// 发送多个图片
const payload = {
  mediaUrls: ["wps-storage:image1", "wps-storage:image2"],
  text: "查看这些图片"
};
```

#### 方式2：使用 channelData 精确控制

如果需要强制指定消息类型，可以使用 `channelData.messageType`：

```typescript
// 强制发送为图片消息
const payload = {
  mediaUrl: "wps-storage:image_key",
  channelData: {
    messageType: "image"
  }
};

// 强制发送为文件消息
const payload = {
  mediaUrl: "wps-storage:file_key",
  channelData: {
    messageType: "file"
  }
};

// 强制发送为富文本消息
const payload = {
  text: "复杂格式内容",
  channelData: {
    messageType: "rich_text"
  }
};
```

### 消息类型判断优先级

系统按以下优先级判断消息类型：

1. **channelData.messageType**（最高优先级）- Agent 精确控制
2. **mediaUrls** - 多个媒体自动使用富文本
3. **mediaUrl** - 单个媒体自动使用图片消息
4. **text**（默认）- 纯文本消息

### 完整示例

```typescript
// 纯文本（Markdown 格式）
{
  text: "这是一条**Markdown**格式的文本消息"
}

// 图片消息
{
  mediaUrl: "wps-storage:xxx",
  text: "图片说明"
}

// 多图片富文本消息
{
  mediaUrls: ["url1", "url2", "url3"],
  text: "多张图片的说明"
}

// 强制文件消息
{
  mediaUrl: "wps-storage:file",
  channelData: {
    messageType: "file"
  }
}
```

### Markdown 支持

所有纯文本消息默认使用 **Markdown 格式**，支持以下语法：

- **粗体**: `**粗体文本**`
- *斜体*: `*斜体文本*`
- 链接: `[文本](https://example.com)`
- 列表: `- 项目1`
- 标题: `# 一级标题`

**示例：**
```typescript
{
  text: "# 欢迎使用\n\n- **功能1**: 支持Markdown\n- **功能2**: 自动识别媒体"
}
```

### 注意事项

- `mediaUrl` 和 `mediaUrls` 通常包含 `wps-storage:storage_key` 格式的存储键
- 系统会自动将 storage_key 转换为临时访问链接（接收消息时）
- 发送消息时，storage_key 需要是有效的
- 如果发送失败，系统会自动降级为文本消息
- **所有文本消息默认使用 Markdown 格式**

---

## TODO 清单

以下功能计划在后续版本中实现：

### 高优先级
- [ ] **卡片交互支持** - 实现 WPS 互动卡片回调（目前在 `gateway.ts:371-372` 处为占位实现）
- [ ] **群成员管理** - 完整实现群成员列表和管理功能
- [ ] **端到端集成测试** - 完成签名验证和消息解密流程的完整测试

### 中优先级
- [ ] **增强错误处理** - 改进媒体 URL 获取失败时的错误信息和恢复机制
- [ ] **批量消息发送** - 支持在单个 API 调用中发送多条消息
- [ ] **富文本解析器** - 更好地解析包含多个元素的复杂富文本消息
- [ ] **消息编辑历史** - 跟踪和显示消息编辑历史用于审计
