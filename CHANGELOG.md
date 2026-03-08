# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2026.03.08] - 2026-03-08
### Fixed
- Outbound config error

## [2026.03.04] - 2026-03-04
### Added
- Add option for custom webhook path

## [2026.03.03] - 2026-03-03

### Added
- Initial npm release of WPS Xiezuo Channel plugin for OpenClaw
- Full support for WPS Xiezuo (WPS 365) enterprise bot integration
- HTTP Callback (Webhook) mode for message reception
- Direct message (DM) and group chat support
- Media message processing (images, files, rich text)
- Flexible message type control via Agent `ReplyPayload`
- Access control policies (open/allowlist for DM and group)
- Signature verification and message decryption
- Automatic media URL conversion (wps-storage keys)
- Markdown formatting support for text messages

### Features
- **HTTP Callback Mode**: Receive messages via Webhook with public network accessibility
- **DM Support**: Direct 1-on-1 interaction with the bot
- **Group Chat Support**: Interaction via @mentions in group channels
- **Media Processing**: Automatic parsing of storage_key and conversion to temporary URLs
- **Message Type Control**: Agent-controlled message types (text, image, file, rich_text)
- **Access Control**: Configurable policies for DM and group chat
- **Security**: AES encryption/decryption and signature verification

### Known Limitations
- **Alpha Stage**: Core logic (signature verification, message decryption) is still undergoing integration testing
- **Card Interaction**: WPS interactive card callbacks are not yet implemented (TODO)
- **Group Member Management**: Full group member management features are pending
- **Not Recommended for Production**: This is an alpha release, use with caution in production environments

### Documentation
- Complete README.md and README-cn.md with installation and configuration guides
- API documentation for Agent message type control
- Troubleshooting guide for common issues
- WPS Developer Platform setup instructions

## [2026.02.24] - 2026-02-24

### Initial Development
- Project initialization
- Core channel implementation
- Basic message handling
- Configuration schema setup

[2026.03.02]: https://github.com/skyispainted/openclaw-channel-wps-xiezuo/compare/2026.02.24...2026.03.02
[2026.02.24]: https://github.com/skyispainted/openclaw-channel-wps-xiezuo/releases/tag/2026.02.24
