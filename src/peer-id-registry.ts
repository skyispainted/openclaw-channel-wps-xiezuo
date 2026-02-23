/**
 * Peer ID 注册表
 *
 * 用于保存原始的peer ID（保持大小写等特性）
 */

const originalPeerIds = new Map<string, string>();

/**
 * 注册原始peer ID
 */
export function registerPeerId(peerId: string): void {
  const lower = peerId.toLowerCase();
  if (!originalPeerIds.has(lower)) {
    originalPeerIds.set(lower, peerId);
  }
}

/**
 * 解析原始peer ID
 */
export function resolveOriginalPeerId(peerId: string): string {
  const lower = peerId.toLowerCase();
  return originalPeerIds.get(lower) || peerId;
}