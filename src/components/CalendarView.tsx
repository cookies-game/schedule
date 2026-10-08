import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType, ScheduleEvent, PaidLeaveBalance, Memo } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Palmtree,
  Users,
  Shield,
  Calendar as CalendarIcon,
  Clock,
  Lock,
  Eye,
  RotateCcw,
  FileText,
  Star,
} from 'lucide-react';
import { PaidLeaveManager } from './PaidLeaveManager';
import { MemoList } from './MemoList';
import { getDisplayUsername, extractUsernameFromEmail, formatDateToYYYYMMDD } from '../utils/authHelper';

interface CalendarViewProps {
  calendar: CalendarType;
  currentUser: User;
  events: ScheduleEvent[];
  balances: Record<string, PaidLeaveBalance>;
  memos?: Memo[];
  isMemberPerspective?: boolean;
  onTogglePerspective?: () => void;
  onOpenNewEvent: (initialDate?: string) => void;
  onOpenNewLeave: (targetUserId?: string, targetUserName?: string, targetUserEmail?: string) => void;
  onOpenNewMemo?: (initialDate?: string) => void;
  onEditMemo?: (memo: Memo) => void;
  onDeleteMemo?: (memoId: string) => Promise<void>;
  onOpenShare: () => void;
  onSelectEvent: (event: ScheduleEvent) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onUpdateGrant: (userId: string, granted: number, userEmail: string, userName: string) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  calendar,
  currentUser,
  events,
  balances,
  memos = [],
  isMemberPerspective = false,
  onTogglePerspective,
  onOpenNewEvent,
  onOpenNewLeave,
  onOpenNewMemo,
  onEditMemo,
  onDeleteMemo,
  onOpenShare,
  onSelectEvent,
  onDeleteEvent,
  onUpdateGrant,
}) => {
  const currentUsername =
    extractUsernameFromEmail(currentUser.email) ||
    getDisplayUsername(currentUser.email, currentUser.displayName);

  // Real owner check
  const isRealOwner = Boolean(
    calendar.ownerId === currentUser.uid ||
    (calendar.ownerEmail && currentUser.email && calendar.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (calendar.ownerUsername && currentUsername && calendar.ownerUsername.toLowerCase() === currentUsername.toLowerCase())
  );

  // Effective permissions: if member perspective is active, behave strictly as member
  const effectiveIsOwner = Boolean(isRealOwner && !isMemberPerspective);

  // Tab view: 'month' | 'paid_leave' | 'members' | 'memos'
  const [currentTab, setCurrentTab] = useState<'month' | 'paid_leave' | 'members' | 'memos'>('month');

  // Month navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build days for month view
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 for Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
  }[] = [];

  const todayStr = formatDateToYYYYMMDD(new Date());

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, day);
    const dateStr = formatDateToYYYYMMDD(prevMonthDate);
    calendarDays.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = new Date(year, month, day);
    const dateStr = formatDateToYYYYMMDD(curDate);
    calendarDays.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days to complete grid (multiples of 7)
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDate = new Date(year, month + 1, day);
    const dateStr = formatDateToYYYYMMDD(nextMonthDate);
    calendarDays.push({
      dayNumber: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Events grouped by date string
  const getEventsForDate = (dateStr: string) => {
    return events.filter((e) => {
      // 有給を設定した日が過ぎたら表示は消す (過去の日付の有給は非表示)
      if (e.isPaidLeave && (e.endDate < todayStr || dateStr < todayStr)) {
        return false;
      }
      return dateStr >= e.startDate && dateStr <= e.endDate;
    });
  };

  // Memos linked to this calendar or date
  const calendarMemos = memos.filter(
    (m) => !m.linkedCalendarId || m.linkedCalendarId === calendar.id || m.calendarId === calendar.id
  );

  const getMemosForDate = (dateStr: string) => {
    return calendarMemos.filter((m) => m.linkedDate === dateStr);
  };

  const dayOfWeekNames = ['日', '月', '火', '水', '木', '金', '土'];

  // All members
  const ownerUname = calendar.ownerUsername || getDisplayUsername(calendar.ownerEmail, calendar.ownerName);
  const rawMembers = calendar.memberUsernames && calendar.memberUsernames.length > 0
    ? calendar.memberUsernames
    : (calendar.memberEmails || []).map((e) => getDisplayUsername(e, null));

  const members = [
    {
      id: calendar.ownerId,
      name: ownerUname,
      email: calendar.ownerEmail,
      isOwner: true,
    },
    ...rawMembers.map((uname) => ({
      id: uname,
      name: uname,
      email: uname,
      isOwner: false,
    })),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Permissions & Perspective Mode Indicator */}
      <div
        className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between flex-wrap gap-3 transition-all ${
          isMemberPerspective
            ? 'bg-blue-50/90 border-blue-200 text-blue-950 shadow-xs'
            : isRealOwner
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          {isRealOwner ? (
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
          )}

          <div className="leading-relaxed">
            {isRealOwner ? (
              isMemberPerspective ? (
                <div>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded mr-1.5 border border-amber-300">
                    管理者
                  </span>
                  <strong className="text-blue-900">【メンバー目線プレビュー中】:</strong>{' '}
                  <span className="text-blue-800">
                    メンバーと同じ視点で閲覧しています（自分の予定のみ変更・削除可能、他の人の予定は閲覧のみ）。
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded mr-1.5 border border-amber-300">
                    管理者
                  </span>
                  <strong>管理者モード:</strong> 全員のスケジュールおよび有給休暇の登録・変更・削除が可能です。
                </div>
              )
            ) : (
              <div>
                <strong>メンバー権限:</strong> 共有カレンダーです。自分のスケジュールのみ登録・変更・削除が可能です（他のメンバーの予定は閲覧のみ）。
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Admin Perspective Toggle Switch */}
          {isRealOwner && onTogglePerspective && (
            <button
              onClick={onTogglePerspective}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer ${
                isMemberPerspective
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {isMemberPerspective ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>管理者目線に戻す</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>メンバー目線で確認</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onOpenShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer text-xs"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>メンバー ({members.length}名)</span>
          </button>
        </div>
      </div>

      {/* Main Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Navigation & Month Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition cursor-pointer"
              title="前月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-white text-slate-700 rounded-lg transition cursor-pointer"
            >
              今日
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition cursor-pointer"
              title="翌月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            {year}年 {month + 1}月
          </h2>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setCurrentTab('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              currentTab === 'month'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>月カレンダー</span>
          </button>
          <button
            onClick={() => setCurrentTab('paid_leave')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              currentTab === 'paid_leave'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palmtree className="w-3.5 h-3.5 text-emerald-600" />
            <span>有給休暇・残数管理</span>
          </button>
          <button
            onClick={() => setCurrentTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              currentTab === 'members'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>メンバー別一覧</span>
          </button>
          <button
            onClick={() => setCurrentTab('memos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              currentTab === 'memos'
                ? 'bg-white text-indigo-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>連携メモ ({calendarMemos.length})</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenNewMemo && onOpenNewMemo()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>メモを追加</span>
          </button>

          <button
            onClick={() => onOpenNewLeave()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Palmtree className="w-3.5 h-3.5" />
            <span>有給を登録</span>
          </button>

          <button
            onClick={() => onOpenNewEvent()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>予定を追加</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Month Grid */}
      {currentTab === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold">
            {dayOfWeekNames.map((d, idx) => (
              <div
                key={d}
                className={`py-2.5 ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-sky-600' : 'text-slate-600'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[600px]">
            {calendarDays.map((calDay, i) => {
              const dayEvents = getEventsForDate(calDay.dateStr);
              const dayMemos = getMemosForDate(calDay.dateStr);
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              const isPastDay = calDay.dateStr < todayStr;

              return (
                <div
                  key={`${calDay.dateStr}-${i}`}
                  onClick={() => {
                    if (!isPastDay) {
                      onOpenNewEvent(calDay.dateStr);
                    }
                  }}
                  className={`min-h-[110px] p-1.5 sm:p-2 transition group flex flex-col justify-between ${
                    isPastDay
                      ? 'cursor-default bg-slate-50/40 text-slate-400'
                      : 'cursor-pointer hover:bg-slate-50/80'
                  } ${
                    !calDay.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : isWeekend
                      ? 'bg-slate-50/20'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        calDay.isToday
                          ? 'bg-indigo-600 text-white font-bold'
                          : calDay.isCurrentMonth
                          ? i % 7 === 0
                            ? 'text-rose-500'
                            : i % 7 === 6
                            ? 'text-sky-600'
                            : isPastDay
                            ? 'text-slate-400'
                            : 'text-slate-700'
                          : 'text-slate-300'
                      }`}
                    >
                      {calDay.dayNumber}
                    </span>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenNewMemo) onOpenNewMemo(calDay.dateStr);
                        }}
                        title="この日にメモを追加"
                        className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                      </button>

                      {!isPastDay && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNewEvent(calDay.dateStr);
                          }}
                          title="この日に予定を追加"
                          className="p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items inside this cell: Linked Memos + Events */}
                  <div className="space-y-1 overflow-y-auto max-h-24 flex-1">
                    {/* Linked Memos for this day */}
                    {dayMemos.map((memo) => (
                      <div
                        key={memo.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditMemo) onEditMemo(memo);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1 shadow-2xs truncate cursor-pointer"
                        title={`[連携メモ] ${memo.title}`}
                      >
                        <FileText className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{memo.title}</span>
                      </div>
                    ))}

                    {/* Schedule Events & Paid Leave */}
                    {dayEvents.map((ev) => {
                      if (ev.isPaidLeave) {
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvent(ev);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition flex items-center gap-1 shadow-2xs truncate"
                            title={`[有給休暇] ${ev.targetUserName}: ${ev.title} (${ev.paidLeaveDays || 1}日)`}
                          >
                            <Palmtree className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span className="truncate">
                              {ev.targetUserName}
                              {ev.paidLeaveDays === 0.5 ? ' (半休)' : ' (有給)'}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(ev);
                          }}
                          style={{
                            borderLeftColor: ev.color || '#4f46e5',
                            backgroundColor: `${ev.color || '#4f46e5'}15`,
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-800 border-l-2 hover:opacity-85 transition truncate shadow-2xs flex items-center justify-between gap-1 ${
                            ev.isImportant ? 'ring-1 ring-amber-400 bg-amber-50/60' : ''
                          }`}
                          title={`${ev.isImportant ? '[重要] ' : ''}${ev.title} (${ev.targetUserName})`}
                        >
                          <div className="flex items-center gap-0.5 truncate">
                            {ev.isImportant && (
                              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-600 mr-0.5">
                              {ev.targetUserName.slice(0, 3)}:
                            </span>
                            <span className="truncate">{ev.title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Paid Leave & Balance Manager */}
      {currentTab === 'paid_leave' && (
        <PaidLeaveManager
          calendar={calendar}
          currentUser={currentUser}
          events={events}
          balances={balances}
          isEffectiveAdmin={effectiveIsOwner}
          onUpdateGrant={onUpdateGrant}
          onOpenNewLeaveModal={onOpenNewLeave}
          onEditEvent={onSelectEvent}
          onDeleteEvent={onDeleteEvent}
        />
      )}

      {/* Tab 3: Member-by-Member Schedule Overview */}
      {currentTab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              メンバー別スケジュール一覧
            </h2>
            <p className="text-xs text-slate-400">
              各メンバーごとの登録済みスケジュールと有給休暇
            </p>
          </div>

          <div className="space-y-6">
            {members.map((member) => {
              const memberEvents = events.filter(
                (e) => {
                  // 有給を設定した日が過ぎたら表示は消す
                  if (e.isPaidLeave && e.endDate < todayStr) {
                    return false;
                  }
                  return (
                    e.targetUserId === member.id ||
                    (e.targetUserName && e.targetUserName.toLowerCase() === member.name.toLowerCase()) ||
                    (e.targetUserEmail && e.targetUserEmail.toLowerCase() === member.email.toLowerCase())
                  );
                }
              );
              const isCurrent =
                member.id === currentUser.uid ||
                member.name.toLowerCase() === currentUsername.toLowerCase() ||
                member.email.toLowerCase() === currentUser.email?.toLowerCase();

              return (
                <div
                  key={member.id}
                  className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {member.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {isCurrent && <span className="text-xs text-slate-400">(あなた)</span>}
                          {member.isOwner && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              管理者
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">@{member.name}</div>
                      </div>
                    </div>

                    {(effectiveIsOwner || isCurrent) && (
                      <button
                        onClick={() => onOpenNewEvent()}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer"
                      >
                        + 予定を追加
                      </button>
                    )}
                  </div>

                  {memberEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">予定はまだ登録されていません。</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                      {memberEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => onSelectEvent(ev)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                            ev.isPaidLeave
                              ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">
                                  {ev.startDate}
                                  {ev.endDate !== ev.startDate && ` 〜 ${ev.endDate}`}
                                </span>
                                {ev.isImportant && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                                    <Star className="w-2.5 h-2.5 fill-white" />
                                    重要
                                  </span>
                                )}
                              </div>
                              {ev.isPaidLeave && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white">
                                  <Palmtree className="w-2.5 h-2.5" />
                                  有給 ({ev.paidLeaveDays || 1}日)
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-xs text-slate-800 line-clamp-1">
                              {ev.title}
                            </h3>
                            {ev.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                                {ev.description}
                              </p>
                            )}
                          </div>
                          {!ev.isAllDay && ev.startTime && (
                            <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {ev.startTime} - {ev.endTime}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Linked Memos */}
      {currentTab === 'memos' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                カレンダー連携メモ・共有ノート
              </h2>
              <p className="text-xs text-slate-400">
                このカレンダー「{calendar.name}」に関連するメモ一覧
              </p>
            </div>
            <button
              onClick={() => onOpenNewMemo && onOpenNewMemo()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>このカレンダーにメモを作成</span>
            </button>
          </div>

          <MemoList
            user={currentUser}
            memos={calendarMemos}
            currentCalendar={calendar}
            onOpenCreateMemo={onOpenNewMemo || (() => {})}
            onEditMemo={onEditMemo || (() => {})}
            onDeleteMemo={onDeleteMemo || (async () => {})}
          />
        </div>
      )}
    </div>
  );
};
