# WPS Xiezuo Channel for OpenClaw

<div align="center">

> [!WARNING]
> **Experimental Version / Alpha Stage**
>
> This plugin is currently in the **Alpha/Active Development** stage.
> - ⚠️ **Stability:** Core logic (signature verification, message decryption) is still undergoing integration testing.
> - ⚠️ **Production Use:** Not recommended for production environments yet.
> - 🛠️ **Contributions:** If you encounter issues or have tested it successfully, please [open an Issue](https://github.com/skyispainted/openclaw-channel-wps-xiezuo/issues).

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
- ✅ **Media Message Support** — Automatic parsing and conversion of WPS-storage media keys.
- ✅ **Flexible Message Types** — Agent-controlled message type selection (text, image, file, rich_text).

## Installation

### Method A: Via npm (Recommended for users)

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

## Auto Configuration

This plugin includes an auto-configuration script that can help you retrieve your company ID automatically.

To use the auto-configuration script:

```bash
# If you have already set up your WPS app credentials as environment variables
WPS_APP_ID="your_app_id" WPS_SECRET_KEY="your_secret_key" WPS_ENCRYPT_KEY="your_encrypt_key" node auto-config.mjs

# Or run the script and enter your credentials when prompted
node auto-config.mjs
```

The script will:
1. Connect to the WPS API using your credentials
2. Automatically fetch your `companyId`
3. Generate the complete configuration for you
4. Optionally save the configuration to `~/.openclaw/config.json`

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
5. **API URL:** Default is `https://openapi.wps.cn`.
6. **Callback URL:** Your public-facing Webhook URL.
7. **Policies:** Set DM and Group policies (`open` or `allowlist`).

---

#### WPS Developer Platform Setup Guide

1. **Create Application:** Visit the [WPS Open Platform](https://open.wps.cn/) and create an Internal Enterprise App.
2. **Message Mode:** Set to **HTTP Callback Mode**.
3. **Retrieve Credentials:** Copy the **App ID**, **Secret Key**, and **Encrypt Key** from the dashboard.
4. **Configure Callback:** Set the Event Subscription URL to:
`http://<YOUR_PUBLIC_IP>:<PORT>/wps-xiezuo/webhook`

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
      "apiUrl": "https://openapi.wps.cn",
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
| `apiUrl` | string | `https://openapi.wps.cn` | WPS OpenAPI endpoint. |
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

---

## Media Message Processing

WPS Xiezuo supports sending images, files, and other media messages. The system automatically parses `storage_key` in these messages and converts them to temporary accessible URLs for AI analysis.

**Supported Message Types:**
* **Image Messages (image):** Automatically parsed and converted to temporary download URLs
* **File Messages (file):** Local files automatically parsed, cloud documents use direct links
* **Rich Text Messages (rich_text):** Extract images and text content

**Notes:**
* Temporary links typically have an expiration time (e.g., 1 hour)
* If link retrieval fails, AI cannot analyze image content

---

## Agent AI Control of Message Types

OpenClaw's Agent can precisely control the message type to send via `ReplyPayload`, without relying on automatic detection.

### Usage Methods

#### Method 1: Using mediaUrl / mediaUrls (Recommended)

Agent only needs to set `mediaUrl` or `mediaUrls`, and the system automatically selects the appropriate message type:

```typescript
// Send image message
const payload = {
  mediaUrl: "wps-storage:image_storage_key",
  text: "This is an image description"  // optional
};

// Send multiple images
const payload = {
  mediaUrls: ["wps-storage:image1", "wps-storage:image2"],
  text: "View these images"
};
```

#### Method 2: Using channelData for Precise Control

If you need to force a specific message type, use `channelData.messageType`:

```typescript
// Force send as image message
const payload = {
  mediaUrl: "wps-storage:image_key",
  channelData: {
    messageType: "image"
  }
};

// Force send as file message
const payload = {
  mediaUrl: "wps-storage:file_key",
  channelData: {
    messageType: "file"
  }
};

// Force send as rich text message
const payload = {
  text: "Complex formatted content",
  channelData: {
    messageType: "rich_text"
  }
};
```

### Message Type Priority

The system determines message type in the following priority order:

1. **channelData.messageType** (Highest Priority) - Agent precise control
2. **mediaUrls** - Multiple media automatically uses rich text
3. **mediaUrl** - Single media automatically uses image message
4. **text** (Default) - Plain text message

### Complete Examples

```typescript
// Plain text (Markdown format)
{
  text: "This is a **Markdown** formatted text message"
}

// Image message
{
  mediaUrl: "wps-storage:xxx",
  text: "Image description"
}

// Multi-image rich text message
{
  mediaUrls: ["url1", "url2", "url3"],
  text: "Description for multiple images"
}

// Force file message
{
  mediaUrl: "wps-storage:file",
  channelData: {
    messageType: "file"
  }
}
```

### Markdown Support

All plain text messages use **Markdown format** by default, supporting the following syntax:

- **Bold**: `**bold text**`
- *Italic*: `*italic text*`
- Links: `[text](https://example.com)`
- Lists: `- item1`
- Headers: `# Level 1 header`

**Example:**
```typescript
{
  text: "# Welcome\n\n- **Feature 1**: Markdown support\n- **Feature 2**: Automatic media detection"
}
```

### Notes

- `mediaUrl` and `mediaUrls` typically contain `wps-storage:storage_key` formatted storage keys
- The system automatically converts storage_key to temporary access links (when receiving messages)
- When sending messages, storage_key must be valid
- If sending fails, the system automatically falls back to text messages
- **All text messages use Markdown format by default**

---

## TODO List

The following features are planned for future implementation:

### High Priority
- [ ] **Card Interaction Support** - Implement WPS interactive card callbacks (currently stubbed in `gateway.ts:371-372`)
- [ ] **Group Member Management** - Full implementation of group member listing and management
- [ ] **End-to-End Integration Testing** - Complete testing of signature verification and message decryption flows

### Medium Priority
- [ ] **Enhanced Error Handling** - Improve error messages and recovery for media URL retrieval failures
- [ ] **Batch Message Sending** - Support sending multiple messages in a single API call
- [ ] **Rich Text Parser** - Better parsing of complex rich text messages with multiple elements
- [ ] **Message Edit History** - Track and display message edit history for audit purposes

