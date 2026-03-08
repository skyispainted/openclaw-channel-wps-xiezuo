# CompanyId 缓存机制

## 概述

为了优化性能并避免重复请求 WPS API 获取 `companyId`，我们实现了启动时预加载和缓存机制。

## 工作流程

### 1. 启动时预加载

在 `gateway.ts` 的 `startSimpleXiezuoAccount` 函数中，启动账号时会自动执行以下操作：

```typescript
// 启动时预加载 companyId
if (config.appId && config.secretKey) {
  try {
    await preloadCompanyId(accountId, config, ctx.log);
  } catch (error) {
    // 预加载失败不影响启动，但会记录警告
    ctx.log?.warn?.(
      `[${accountId}] ⚠️ 预加载 companyId 失败，将在首次发送消息时尝试获取: ${error}`
    );
  }
}
```

### 2. 缓存策略

- **用户配置优先**：如果用户在配置文件中已经提供了 `companyId`，直接使用，不再请求 API
- **自动获取缓存**：如果配置中未提供，启动时自动调用 WPS API 获取并缓存
- **内存缓存**：使用内存对象缓存 `companyId`，启动后不会重复请求

### 3. 配置使用

用户可以在配置文件中直接提供 `companyId`：

```javascript
export default {
  channels: {
    "wps-xiezuo": {
      appId: "your-app-id",
      secretKey: "your-secret-key",
      companyId: "your-company-id",  // 👈 直接配置，避免自动获取
      enabled: true,
    },
  },
};
```

## 核心文件

### company-id-cache.ts

缓存管理器，提供以下功能：

- `preloadCompanyId()` - 启动时预加载
- `getCachedCompanyId()` - 获取缓存的 companyId
- `cacheCompanyId()` - 缓存 companyId
- `getCompleteConfig()` - 获取完整配置（包含缓存的 companyId）

### 修改的文件

1. **gateway.ts** - 启动时调用 `preloadCompanyId`
2. **outbound-service.ts** - 使用 `getCompleteConfig` 获取配置，不再调用 `ensureConfigComplete`
3. **channel.ts** - 使用 `getCompleteConfig` 获取配置，不再调用 `ensureConfigComplete`

## 优势

1. ✅ **性能优化**：启动时一次性获取，后续发送消息无需额外 API 调用
2. ✅ **用户可控**：用户可以手动配置 `companyId`，完全跳过自动获取
3. ✅ **容错处理**：预加载失败不影响启动，后续发送消息时会再次尝试
4. ✅ **缓存验证**：缓存会验证 `appId` 匹配，防止配置变更后使用错误的缓存

## 注意事项

- 如果配置变更（更换 `appId`），需要重启服务以重新加载 `companyId`
- 缓存存储在内存中，服务重启后需要重新获取
