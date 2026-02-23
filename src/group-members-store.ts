/**
 * 群成员存储
 */

interface GroupMember {
  id: string;
  name?: string;
  timestamp: number;
}

const groupMembersStore = new Map<string, Map<string, GroupMember>>();

/**
 * 记录群成员
 */
export function noteGroupMember(
  storePath: string,
  groupId: string,
  memberId: string,
  memberName?: string
): void {
  let group = groupMembersStore.get(groupId);
  if (!group) {
    group = new Map();
    groupMembersStore.set(groupId, group);
  }

  group.set(memberId, {
    id: memberId,
    name: memberName,
    timestamp: Date.now(),
  });

  // 清理过期成员（30天）
  cleanupExpiredMembers(group);
}

/**
 * 获取群成员列表
 */
export function getGroupMembers(groupId: string): GroupMember[] {
  const group = groupMembersStore.get(groupId);
  if (!group) {
    return [];
  }

  return Array.from(group.values());
}

/**
 * 格式化群成员列表为字符串
 */
export function formatGroupMembers(groupId: string): string | undefined {
  const members = getGroupMembers(groupId);
  if (members.length === 0) {
    return undefined;
  }

  const memberList = members
    .map(m => m.name ? `${m.name} (${m.id})` : m.id)
    .join(", ");

  return `群成员: ${memberList}`;
}

/**
 * 清理过期成员（30天）
 */
function cleanupExpiredMembers(group: Map<string, GroupMember>): void {
  const now = Date.now();
  const expiryMs = 30 * 24 * 60 * 60 * 1000; // 30天

  for (const [memberId, member] of group.entries()) {
    if (now - member.timestamp > expiryMs) {
      group.delete(memberId);
    }
  }
}