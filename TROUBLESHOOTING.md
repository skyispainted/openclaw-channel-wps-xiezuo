# 解决 "Outbound not configured for channel: wps-xiezuo" 错误

## 错误分析

您遇到的错误 "Outbound not configured for channel: wps-xiezuo" 表明WPS协作通道的出站消息功能未正确配置。这通常是由于缺少必要的API凭据或配置信息。

### 可能的原因

1. **缺少必需的API凭据**：
   - `appId`（WPS应用ID）未配置
   - `secretKey`（WPS应用密钥）未配置
   - `companyId`（公司ID）未配置

2. **配置不完整**：
   - 虽然提供了部分凭据，但并非所有必需字段都已填写

3. **权限不足**：
   - WPS应用没有向目标群聊发送消息的权限

## 解决步骤

### 1. 获取WPS应用凭据

首先，您需要在WPS开发者平台创建应用并获取以下凭据：

- **App ID**: WPS应用ID
- **Secret Key**: WPS应用密钥
- **Encrypt Key**: 加密密钥（用于回调验证）

### 2. 使用自动配置脚本（推荐）

我们提供了一个自动配置脚本，可以帮您获取`companyId`并验证完整配置：

```bash
# 设置环境变量后运行
WPS_APP_ID="your_app_id" WPS_SECRET_KEY="your_secret_key" WPS_ENCRYPT_KEY="your_encrypt_key" npm run auto-config

# 或者直接运行并按提示输入
npm run auto-config
```

脚本将：
- 验证API凭据是否有效
- 连接到WPS API并自动获取`companyId`
- 生成完整的配置
- 可选择性地将配置保存到`~/.openclaw/config.json`

### 3. 手动配置

如果不想使用自动配置脚本，可以手动编辑配置文件：

1. 打开 `~/.openclaw/config.json` 文件
2. 添加或更新以下配置：

```json
{
  "channels": {
    "wps-xiezuo": {
      "enabled": true,
      "appId": "your_wps_app_id",
      "secretKey": "your_wps_secret_key",
      "encryptKey": "your_wps_encrypt_key",
      "companyId": "your_company_id",  // 自动获取或手动配置
      "apiUrl": "https://openapi.wps.cn"
    }
  }
}
```

### 4. 验证配置

配置完成后，验证连接是否成功：

```bash
# 检查通道状态
openclaw channels status

# 测试插件连接
openclaw plugins probe wps-xiezuo
```

### 5. 重启服务

配置完成后，重启OpenClaw服务：

```bash
openclaw gateway restart
```

## 重要说明

1. **companyId获取**: 我们的插件现在包含了自动获取`companyId`的功能，它通过WPS的`/v7/users/current` API端点获取。如果手动配置，请确保该值正确。

2. **权限验证**: 确保您的WPS应用具有向目标群聊发送消息的权限。

3. **网络访问**: 确保您的服务器能够访问WPS API（https://openapi.wps.cn）。

## 故障排除

如果仍然遇到问题：

1. 检查API凭据是否正确无误
2. 确认WPS应用是否在目标群聊中可用
3. 查看OpenClaw日志以获取更详细的错误信息
4. 使用`openclaw gateway logs`命令查看实时日志

## 关于群聊ID 82350161

如果定时任务仍然无法向群聊ID `82350161` 发送消息，请确认：

1. 您的WPS应用机器人已加入该群聊
2. 该群聊的ID确实为`82350161`（请注意可能需要特定格式，如加上`wps:`前缀）
3. 您的应用具有在该群聊中发送消息的权限

通过以上步骤，您应该能够解决"Outbound not configured for channel: wps-xiezuo"错误，并让定时任务正常向WPS群聊发送消息。