# WPS 协作 Channel - Agent 开发者指南

## 概述

本文档为 OpenClaw Agent 开发者提供在 WPS 协作 Channel 中发送消息的完整指南。Agent 可以通过 `ReplyPayload` 精确控制消息类型。

## 基础概念

### ReplyPayload

OpenClaw 使用 `ReplyPayload` 结构来传递回复内容：

```typescript
export type ReplyPayload = {
    text?: string;              // 消息文本
    mediaUrl?: string;          // 单个媒体URL（storage_key）
    mediaUrls?: string[];       // 多个媒体URL数组
    replyToId?: string;         // 回复的消息ID
    replyToTag?: boolean;       // 是否添加回复标签
    audioAsVoice?: boolean;     // 音频作为语音消息
    isError?: boolean;          // 是否为错误消息
    channelData?: Record<string, unknown>;  // Channel特定数据
};
```

### 消息类型判断优先级

系统按照以下优先级判断消息类型：

1. **`channelData.messageType`** - Agent 精确控制（最高优先级）
2. **`mediaUrls`** - 多个媒体，自动使用富文本
3. **`mediaUrl`** - 单个媒体，自动使用图片/文件消息
4. **`text`** - 纯文本（默认）

## 使用方式

### 1. 发送纯文本消息

最简单的使用方式，只设置 `text`：

```typescript
// 纯文本消息
const payload = {
  text: "这是一条文本消息"
};
```

**支持的格式：**
- 普通文本
- Markdown 格式（需要在发送时指定）

### 2. 发送图片消息

#### 方式 A：使用 mediaUrl（自动判断）

```typescript
const payload = {
  mediaUrl: "wps-storage:image_storage_key",
  text: "这是一张图片的说明文字"  // 可选
};
```

系统会自动识别为图片消息并发送。

#### 方式 B：使用 channelData 强制指定

```typescript
const payload = {
  mediaUrl: "wps-storage:image_storage_key",
  text: "图片说明",
  channelData: {
    messageType: "image"
  }
};
```

### 3. 发送文件消息

#### 发送本地文件

```typescript
const payload = {
  mediaUrl: "wps-storage:file_storage_key",
  channelData: {
    messageType: "file"
  }
};
```

**注意：** 文件消息需要明确指定 `messageType: "file"`，否则系统可能将其识别为图片消息。

### 4. 发送多个媒体（富文本）

#### 多张图片

```typescript
const payload = {
  mediaUrls: [
    "wps-storage:image1",
    "wps-storage:image2",
    "wps-storage:image3"
  ],
  text: "这是三张图片的说明"  // 可选
};
```

系统会自动使用富文本消息格式。

#### 图片 + 文本混合

```typescript
const payload = {
  mediaUrls: [
    "wps-storage:image1",
    "wps-storage:image2"
  ],
  text: "先查看这些图片，然后阅读以下说明..."
};
```

### 5. 强制使用富文本消息

```typescript
const payload = {
  text: "需要使用富文本格式的复杂内容",
  channelData: {
    messageType: "rich_text"
  }
};
```

### 6. 高级富文本控制

如果需要更精细的富文本控制，可以构建完整的富文本元素：

```typescript
const payload = {
  text: "复杂内容",
  channelData: {
    messageType: "rich_text",
    richTextElements: [
      // 自定义富文本元素
      { ... }
    ]
  }
};
```

**注意：** 当前版本主要通过 `mediaUrls` 自动构建富文本，未来会支持更灵活的自定义。

## 发送消息的 Agent 代码示例

### 示例 1：简单回复

```typescript
async function handleRequest(context: any): Promise<ReplyPayload> {
  return {
    text: "你好！我是一个 AI 助手。"
  };
}
```

### 示例 2：包含图片的回复

```typescript
async function showImage(context: any): Promise<ReplyPayload> {
  // 假设我们有一个图片的 storage_key
  const imageKey = "wps-storage:abc123";

  return {
    mediaUrl: imageKey,
    text: "这是你要查看的图片"
  };
}
```

### 示例 3：多图片画廊

```typescript
async function showGallery(context: any): Promise<ReplyPayload> {
  const imageKeys = [
    "wps-storage:image1",
    "wps-storage:image2",
    "wps-storage:image3"
  ];

  return {
    mediaUrls: imageKeys,
    text: "图库展示（共3张）"
  };
}
```

### 示例 4：发送文件

```typescript
async function sendDocument(context: any): Promise<ReplyPayload> {
  const fileKey = "wps-storage:document123";

  return {
    mediaUrl: fileKey,
    channelData: {
      messageType: "file"
    }
  };
}
```

### 示例 5：根据上下文动态选择

```typescript
async function dynamicResponse(context: any): Promise<ReplyPayload> {
  const { query, hasImages } = context;

  if (hasImages) {
    // 有图片时发送图片
    return {
      mediaUrls: await getImageKeys(query),
      text: `关于"${query}"的图片结果`
    };
  } else {
    // 没有图片时发送文本
    return {
      text: await getTextResponse(query)
    };
  }
}
```

## Storage Key 说明

### 什么是 Storage Key

WPS 协作使用 `storage_key` 来标识文件和图片。格式为：

```
wps-storage:{key}
```

例如：
- `wps-storage:abc123def456` - 图片的 storage_key
- `wps-storage:xyz789uvw012` - 文件的 storage_key

### 如何获取 Storage Key

1. **接收消息时**：系统会自动从接收到的消息中提取 storage_key
2. **发送消息时**：需要通过 WPS API 上传文件获取

### Storage Key 与 URL 的关系

- **接收时**：系统自动将 `storage_key` 转换为临时访问链接
- **发送时**：直接使用 `storage_key`，不需要转换

## 错误处理

### 发送失败的降级策略

如果特定类型的消息发送失败，系统会自动降级：

1. 图片消息发送失败 → 降级为文本消息
2. 富文本消息发送失败 → 降级为纯文本
3. 文件消息发送失败 → 降级为文本消息（包含文件链接）

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `storage_key 无效` | storage_key 已过期或不存在 | 重新获取有效的 storage_key |
| `权限不足` | API token 缺少权限 | 检查应用权限配置 |
| `消息类型不支持` | 指定了不支持的消息类型 | 使用支持的类型：text, image, file, rich_text |

## 最佳实践

### 1. 优先使用自动判断

```typescript
// ✅ 推荐：让系统自动判断
return {
  mediaUrl: storageKey,
  text: "说明文字"
};

// ❌ 不推荐：除非有特殊需求，不要强制指定
return {
  mediaUrl: storageKey,
  text: "说明文字",
  channelData: {
    messageType: "image"
  }
};
```

### 2. 提供有意义的文本说明

```typescript
// ✅ 好的做法
return {
  mediaUrl: imageKey,
  text: "这是关于天气的分析图表，请查看详细数据"
};

// ❌ 差的做法
return {
  mediaUrl: imageKey
};
```

### 3. 合理使用多图片

```typescript
// ✅ 推荐：3-5 张相关图片
return {
  mediaUrls: [key1, key2, key3],
  text: "产品展示"
};

// ❌ 不推荐：过多图片
return {
  mediaUrls: [key1, key2, key3, key4, key5, key6, key7, key8, key9, key10],
  text: "所有图片"
};
```

### 4. 错误信息清晰

```typescript
// ✅ 好的做法
if (!imageKey) {
  return {
    text: "⚠️ 未能生成图片，请稍后重试。",
    isError: true
  };
}

// ✅ 提供替代方案
if (!imageKey) {
  return {
    text: "图片生成中... 这是文字版摘要：\n" + summary
  };
}
```

## 调试技巧

### 1. 查看日志

```bash
openclaw logs | grep wps-xiezuo
```

### 2. 启用调试模式

在配置中添加：

```json
{
  "channels": {
    "wps-xiezuo": {
      "debug": true
    }
  }
}
```

### 3. 验证 storage_key 有效性

在发送前验证：

```typescript
function isValidStorageKey(key: string): boolean {
  return key.startsWith("wps-storage:") && key.length > 15;
}

if (!isValidStorageKey(storageKey)) {
  console.warn("Invalid storage key:", storageKey);
}
```

## 完整示例项目

### 图片分析 Agent

```typescript
async function analyzeImage(context: any): Promise<ReplyPayload> {
  const { mediaUrl, query } = context;

  if (!mediaUrl) {
    return {
      text: "❌ 请先发送一张图片给我分析。"
    };
  }

  try {
    // 分析图片
    const analysis = await ai.analyzeImage(mediaUrl, query);

    return {
      mediaUrl: mediaUrl,
      text: `🔍 **图片分析结果：**\n\n${analysis}`
    };
  } catch (error) {
    return {
      text: `⚠️ 分析失败：${error.message}`,
      isError: true
    };
  }
}
```

### 文件处理 Agent

```typescript
async function processFile(context: any): Promise<ReplyPayload> {
  const { mediaUrl } = context;

  if (!mediaUrl) {
    return {
      text: "❌ 请发送一个文件。"
    };
  }

  try {
    // 处理文件
    const result = await processDocument(mediaUrl);

    return {
      text: `✅ **处理完成：**\n\n${result.summary}`,
      channelData: {
        messageType: "text"
      }
    };
  } catch (error) {
    return {
      text: `❌ 处理失败：${error.message}`,
      isError: true
    };
  }
}
```

## API 参考

### ReplyPayload 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 否 | 消息文本内容 |
| `mediaUrl` | string | 否 | 单个媒体的 storage_key |
| `mediaUrls` | string[] | 否 | 多个媒体的 storage_key 列表 |
| `replyToId` | string | 否 | 要回复的消息 ID |
| `replyToTag` | boolean | 否 | 是否添加回复标签 |
| `isError` | boolean | 否 | 是否为错误消息 |
| `channelData` | object | 否 | Channel 特定数据 |

### channelData.messageType 可选值

| 值 | 说明 | 需要的字段 |
|-----|------|-----------|
| `"text"` | 文本消息 | `text` |
| `"image"` | 图片消息 | `mediaUrl` |
| `"file"` | 文件消息 | `mediaUrl` |
| `"rich_text"` | 富文本消息 | `text` 或 `mediaUrls` |

## 常见问题（FAQ）

**Q: 如何知道 storage_key 是否有效？**

A: 发送消息时如果 storage_key 无效，会收到错误响应。建议在发送前进行验证。

**Q: 临时链接有过期时间吗？**

A: 是的，临时链接通常有1小时有效期。但发送消息时直接使用 storage_key，不需要关心链接过期。

**Q: 可以同时发送图片和文本吗？**

A: 可以！设置 `mediaUrl` 和 `text`，系统会自动处理。文本作为图片的说明。

**Q: 最多可以发送多少张图片？**

A: WPS API 对富文本消息的元素数量有限制，建议不超过10个元素（图片+文本）。
