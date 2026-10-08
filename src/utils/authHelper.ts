/**
 * Converts a username into a deterministic, valid email address for Firebase Auth.
 * Handles English, numbers, symbols, and Japanese (hiragana/katakana/kanji) cleanly.
 */
export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  // If it consists of ascii letters, numbers, underscores, dots, hyphens
  if (/^[a-z0-9_.-]+$/.test(clean)) {
    return `${clean}@schedule.internal`;
  }
  // For unicode/Japanese, convert UTF-8 bytes to hex string:
  const hex = Array.from(new TextEncoder().encode(clean))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `u_${hex}@schedule.internal`;
}

/**
 * Extracts or restores display username from email or displayName
 */
export function getDisplayUsername(email?: string | null, displayName?: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }
  return extractUsernameFromEmail(email) || 'ゲスト';
}

/**
 * Specifically extracts login username from email without relying on displayName
 */
export function extractUsernameFromEmail(email?: string | null): string {
  if (!email) return '';
  if (email.endsWith('@schedule.internal')) {
    const local = email.replace('@schedule.internal', '');
    if (local.startsWith('u_')) {
      try {
        const hex = local.slice(2);
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
        return new TextDecoder().decode(bytes);
      } catch {
        return local;
      }
    }
    return local;
  }
  return email.split('@')[0];
}

/**
 * Returns all potential identifiers for a user to ensure flawless balance and event lookup
 */
export function getUserIdentifiers(
  uid?: string | null,
  email?: string | null,
  displayName?: string | null,
  explicitUsername?: string | null
): string[] {
  const ids: string[] = [];
  if (uid) ids.push(uid.trim().toLowerCase());
  if (explicitUsername) ids.push(explicitUsername.trim().toLowerCase());
  if (displayName) ids.push(displayName.trim().toLowerCase());
  if (email) {
    ids.push(email.trim().toLowerCase());
    const uname = extractUsernameFromEmail(email);
    if (uname) ids.push(uname.toLowerCase());
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

/**
 * Formats a Date object to local YYYY-MM-DD string without UTC shift issues.
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Robustly calculates granted, used, and remaining paid leave days for any member.
 */
export function calculateUserLeaveStats(
  memberId: string,
  memberName: string | undefined,
  memberEmail: string | undefined,
  events: { isPaidLeave?: boolean; paidLeaveDays?: number; targetUserId?: string; targetUserName?: string; targetUserEmail?: string; id?: string }[],
  balances: Record<string, { totalGranted?: number; userId?: string; userName?: string; userEmail?: string }>,
  excludeEventId?: string
): { granted: number; used: number; remaining: number } {
  const rawIdentifiers = getUserIdentifiers(memberId, memberEmail, memberName, memberName);
  if (memberId) rawIdentifiers.push(memberId.toLowerCase());
  if (memberName) rawIdentifiers.push(memberName.toLowerCase());
  if (memberEmail) {
    rawIdentifiers.push(memberEmail.toLowerCase());
    const uFromEmail = extractUsernameFromEmail(memberEmail);
    if (uFromEmail) rawIdentifiers.push(uFromEmail.toLowerCase());
  }

  // Calculate used days
  const used = events
    .filter((e) => {
      if (!e.isPaidLeave) return false;
      if (excludeEventId && e.id === excludeEventId) return false;
      const targetAliases = [
        e.targetUserId?.toLowerCase(),
        e.targetUserName?.toLowerCase(),
        e.targetUserEmail?.toLowerCase(),
        extractUsernameFromEmail(e.targetUserEmail)?.toLowerCase(),
      ].filter(Boolean);
      return rawIdentifiers.some((id) => targetAliases.includes(id));
    })
    .reduce((acc, curr) => acc + (curr.paidLeaveDays || 1), 0);

  // Calculate granted days
  let granted = 20; // Default
  let found = false;

  // 1. Direct key match
  for (const key of rawIdentifiers) {
    if (balances[key]?.totalGranted !== undefined) {
      granted = balances[key].totalGranted!;
      found = true;
      break;
    }
  }

  // 2. Scan all balances by alias
  if (!found) {
    for (const b of Object.values(balances)) {
      if (b.totalGranted !== undefined) {
        const bAliases = [
          b.userId?.toLowerCase(),
          b.userName?.toLowerCase(),
          b.userEmail?.toLowerCase(),
          extractUsernameFromEmail(b.userEmail)?.toLowerCase(),
        ].filter(Boolean);

        if (rawIdentifiers.some((id) => bAliases.includes(id))) {
          granted = b.totalGranted;
          break;
        }
      }
    }
  }

  const remaining = Math.max(0, granted - used);
  return { granted, used, remaining };
}
