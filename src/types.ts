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
