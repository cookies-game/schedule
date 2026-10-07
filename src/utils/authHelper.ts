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
