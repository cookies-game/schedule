export type UserRole = 'owner' | 'admin' | 'member';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  color: string;
  ownerId: string;
  ownerUsername?: string;
  ownerEmail: string;
  ownerName?: string;
  memberIds: string[];
  memberUsernames?: string[];
  memberEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarMember {
  userId: string;
  email: string;
  displayName?: string;
  role: UserRole;
  joinedAt: string;
}

export interface ScheduleEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  isPaidLeave: boolean; // 有給かどうか
  paidLeaveDays: number; // 1 or 0.5
  isImportant?: boolean; // 重要タグ
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  targetUserId: string; // 対象メンバー
  targetUserName: string;
  targetUserEmail: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaidLeaveBalance {
  userId: string;
  userEmail: string;
  userName?: string;
  totalGranted: number; // 付与日数 (例: 20日)
  used: number; // 取得済み・予定日数
  notes?: string;
  updatedAt: string;
}

export interface Memo {
  id: string;
  calendarId?: string; // Optional if not linked to a specific calendar
  linkedCalendarId?: string;
  linkedCalendarName?: string;
  title: string;
  content: string;
  category?: string;
  linkedDate?: string; // YYYY-MM-DD
  linkedEventId?: string;
  color?: string;
  isPinned?: boolean;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  creatorEmail?: string;
  sharedWithUsernames?: string[]; // Shared with these specific usernames
  sharedWithEmails?: string[];
  createdAt: string;
  updatedAt: string;
}
