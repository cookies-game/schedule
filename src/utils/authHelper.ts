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
  if (!email) return 'ゲスト';
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
