import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType, ScheduleEvent, PaidLeaveBalance } from '../types';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  Trash2,
  Check,
  Palmtree,
  Shield,
  AlertCircle,
  Lock,
  Star,
  Info,
} from 'lucide-react';

import { getDisplayUsername, calculateUserLeaveStats, formatDateToYYYYMMDD } from '../utils/authHelper';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ScheduleEvent | null; // null for new event
  initialDate?: string;
  isInitialPaidLeave?: boolean;
  initialTargetUser?: { id: string; name: string; email: string };
  calendar: CalendarType;
  currentUser: User;
  events?: ScheduleEvent[];
  balances?: Record<string, PaidLeaveBalance>;
  isEffectiveAdmin?: boolean;
  onSave: (eventData: Omit<ScheduleEvent, 'id' | 'calendarId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

const EVENT_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald (Paid Leave default)
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#7c3aed', // Purple
];

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  event,
  initialDate,
  isInitialPaidLeave = false,
  initialTargetUser,
  calendar,
  currentUser,
  events = [],
  balances = {},
  isEffectiveAdmin,
  onSave,
  onDelete,
}) => {
  const currentUsername = getDisplayUsername(currentUser.email, currentUser.displayName);

  // Check if current user is admin/owner of this calendar
  const realIsOwner =
    calendar.ownerId === currentUser.uid ||
    (calendar.ownerEmail && currentUser.email && calendar.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (calendar.ownerUsername && currentUsername && calendar.ownerUsername.toLowerCase() === currentUsername.toLowerCase());

  const isOwner = isEffectiveAdmin !== undefined ? isEffectiveAdmin : realIsOwner;

  // Check if this event belongs to the current user
  const isMyEvent = event
    ? (
        event.targetUserId === currentUser.uid ||
        event.creatorId === currentUser.uid ||
        (event.targetUserName && currentUsername && event.targetUserName.toLowerCase() === currentUsername.toLowerCase()) ||
        (event.targetUserEmail && currentUser.email && event.targetUserEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (event.creatorEmail && currentUser.email && event.creatorEmail.toLowerCase() === currentUser.email.toLowerCase())
      )
    : true;

  // Admin can edit/delete all events. Non-admin can ONLY edit/delete their own event.
  const canEdit = !event || isOwner || isMyEvent;

  // Current date (today) in local YYYY-MM-DD
  const todayStr = formatDateToYYYYMMDD(new Date());

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(
    initialDate && initialDate >= todayStr ? initialDate : todayStr
  );
  const [endDate, setEndDate] = useState(
    initialDate && initialDate >= todayStr ? initialDate : todayStr
  );
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isAllDay, setIsAllDay] = useState(true);
  const [isPaidLeave, setIsPaidLeave] = useState(false);
  const [paidLeaveDays, setPaidLeaveDays] = useState<number>(1);
  const [isImportant, setIsImportant] = useState<boolean>(false);
  const [color, setColor] = useState(EVENT_COLORS[0]);

  // Target member state (who is this event for)
  const [targetUserId, setTargetUserId] = useState<string>(currentUser.uid);
  const [targetUserName, setTargetUserName] = useState<string>(currentUsername);
  const [targetUserEmail, setTargetUserEmail] = useState<string>(currentUser.email || '');

  const [loading, setLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build member choices: Owner + members
  const ownerUname = calendar.ownerUsername || getDisplayUsername(calendar.ownerEmail, calendar.ownerName);
  const rawMembers = calendar.memberUsernames && calendar.memberUsernames.length > 0
    ? calendar.memberUsernames
    : (calendar.memberEmails || []).map((e) => getDisplayUsername(e, null));

  const memberOptions = [
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

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setStartDate(event.startDate);
      setEndDate(event.endDate);
      setStartTime(event.startTime || '09:00');
      setEndTime(event.endTime || '18:00');
      setIsAllDay(event.isAllDay);
      setIsPaidLeave(event.isPaidLeave);
      setPaidLeaveDays(event.paidLeaveDays || 1);
      setIsImportant(event.isImportant || false);
      setColor(event.color || EVENT_COLORS[0]);
      setTargetUserId(event.targetUserId);
      setTargetUserName(event.targetUserName);
      setTargetUserEmail(event.targetUserEmail);
    } else {
      const defaultDate = initialDate && initialDate >= todayStr ? initialDate : todayStr;
      const startAsLeave = isInitialPaidLeave;
      setTitle(startAsLeave ? '有給休暇' : '');
      setDescription('');
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setStartTime('09:00');
      setEndTime('18:00');
      setIsAllDay(true);
      setIsPaidLeave(startAsLeave);
      setPaidLeaveDays(1);
      setIsImportant(false);
      setColor(startAsLeave ? '#059669' : EVENT_COLORS[0]);

      if (initialTargetUser) {
        setTargetUserId(initialTargetUser.id);
        setTargetUserName(initialTargetUser.name);
        setTargetUserEmail(initialTargetUser.email);
      } else {
        setTargetUserId(currentUser.uid);
        setTargetUserName(currentUsername);
        setTargetUserEmail(currentUser.email || '');
      }
    }
    setError(null);
  }, [event, initialDate, isInitialPaidLeave, initialTargetUser, currentUser, isOpen]);

  // Calculate live leave balance for the currently selected target member
  const currentTargetStats = calculateUserLeaveStats(
    targetUserId,
    targetUserName,
    targetUserEmail,
    events,
    balances,
    event?.id // Exclude currently editing event so its days aren't double counted
  );

  const remainingPTO = currentTargetStats.remaining;
  const isOverLeaveLimit = isPaidLeave && paidLeaveDays > remainingPTO;

  if (!isOpen) return null;

  const handlePaidLeaveToggle = (checked: boolean) => {
    setIsPaidLeave(checked);
    if (checked) {
      if (!title || title === '') {
        setTitle('有給休暇');
      }
      setColor('#059669'); // Emerald green
      setIsAllDay(true);
    } else {
      if (title === '有給休暇') {
        setTitle('');
      }
      setColor(EVENT_COLORS[0]);
    }
  };

  const handleMemberSelect = (val: string) => {
    const selected = memberOptions.find((m) => m.id === val || m.name === val || m.email === val);
    if (selected) {
      setTargetUserId(selected.id);
      setTargetUserName(selected.name);
      setTargetUserEmail(selected.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canEdit) return;

    if (startDate < todayStr) {
      setError('使っている日（今日）より前の日にはスケジュールを設定できません。');
      return;
    }

    if (isPaidLeave && isOverLeaveLimit) {
      setError(`有給休暇の残日数が不足しています。（残り: ${remainingPTO}日 / 申請: ${paidLeaveDays}日）`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate: endDate >= startDate ? endDate : startDate,
        startTime: isAllDay ? '' : (startTime || ''),
        endTime: isAllDay ? '' : (endTime || ''),
        isAllDay,
        isPaidLeave,
        paidLeaveDays: isPaidLeave ? paidLeaveDays : 0,
        isImportant,
        color,
        creatorId: currentUser.uid,
        creatorName: currentUsername,
        creatorEmail: currentUser.email || '',
        targetUserId,
        targetUserName,
        targetUserEmail,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!event || !onDelete || !canEdit) return;

    setLoading(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || '削除に失敗しました');
      setIsConfirmingDelete(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl text-white flex items-center justify-center"
              style={{ backgroundColor: isPaidLeave ? '#059669' : color }}
            >
              {isPaidLeave ? <Palmtree className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  {event ? (canEdit ? '予定の編集' : '予定の詳細') : '新しい予定の登録'}
                </h2>
                {isImportant && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                    <Star className="w-2.5 h-2.5 fill-white" />
                    重要
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">{calendar.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-only banner if user cannot edit */}
        {!canEdit && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2 shrink-0">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>閲覧のみ:</strong> この予定は「{event?.targetUserName}」さんのスケジュールです。管理者以外のメンバーは自分の予定のみ変更・削除できます。
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Paid Leave Highlight Option */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isPaidLeave
                ? isOverLeaveLimit
                  ? 'bg-rose-50/90 border-rose-300'
                  : 'bg-emerald-50/80 border-emerald-200'
                : 'bg-slate-50/60 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={isPaidLeave}
                  onChange={(e) => handlePaidLeaveToggle(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Palmtree className="w-4 h-4 text-emerald-600" />
                  有給休暇 (PTO) として登録する
                </span>
              </label>

              {isPaidLeave && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPaidLeaveDays(1)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition ${
                      paidLeaveDays === 1
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    1日 (全休)
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPaidLeaveDays(0.5)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition ${
                      paidLeaveDays === 0.5
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    0.5日 (半休)
                  </button>
                </div>
              )}
            </div>

            {isPaidLeave && (
              <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="text-emerald-900">
                    <strong>{targetUserName}</strong> さんの有給残日数:
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      remainingPTO <= 0
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : remainingPTO < 3
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    残り {remainingPTO} 日
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    (付与 {currentTargetStats.granted}日 / 取得済 {currentTargetStats.used}日)
                  </span>
                </div>

                {isOverLeaveLimit && (
                  <div className="w-full text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-white/80 p-1.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      有給残数が不足しているため、これ以上の有休は取得できません。（残数: {remainingPTO}日）
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Important Tag Toggle */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
              />
              <div className="flex items-center gap-1.5">
                <Star
                  className={`w-4 h-4 transition ${
                    isImportant ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs font-bold text-slate-800">重要タグをつける</span>
              </div>
            </label>
            <span className="text-[11px] text-slate-400">
              カレンダー上で「重要」バッジが表示されます
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              タイトル <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!canEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPaidLeave ? '有給休暇' : '予定のタイトルを入力'}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {/* Target Member (Role-based: Admin can assign anyone; member locked to self) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                対象メンバー
              </span>
              {isOwner ? (
                <span className="text-[10px] text-amber-700 font-medium flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  管理者は全員の予定を設定・変更可能
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">自分の予定のみ設定可能</span>
              )}
            </label>

            {isOwner && canEdit ? (
              <select
                value={targetUserId}
                onChange={(e) => handleMemberSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {memberOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isOwner ? '★管理者' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium flex items-center justify-between">
                <span>@{targetUserName}</span>
                <span className="text-[10px] text-slate-400">あなた</span>
              </div>
            )}
          </div>

          {/* Dates & Times */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">日時設定</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                />
                終日
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  開始日 <span className="text-[10px] text-indigo-600 font-semibold">(本日以降)</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={!canEdit}
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">終了日</label>
                <input
                  type="date"
                  required
                  disabled={!canEdit}
                  value={endDate}
                  min={startDate >= todayStr ? startDate : todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    開始時間
                  </label>
                  <input
                    type="time"
                    disabled={!canEdit}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    終了時間
                  </label>
                  <input
                    type="time"
                    disabled={!canEdit}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">説明・メモ</label>
            <textarea
              rows={2}
              disabled={!canEdit}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細情報や連絡事項など"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
            />
          </div>

          {/* Color tag */}
          {!isPaidLeave && canEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">カラーラベル</label>
              <div className="flex items-center gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition ring-2 ring-offset-1 ring-transparent cursor-pointer"
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
            {event && canEdit ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-rose-50 p-1.5 px-2.5 rounded-xl border border-rose-200">
                  <span className="text-[11px] text-rose-700 font-bold">削除しますか？</span>
                  <button
                    type="button"
                    onClick={handleExecuteDelete}
                    disabled={loading}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    はい
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
                  >
                    いいえ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>削除</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              {canEdit && (
                <button
                  type="submit"
                  disabled={loading || isOverLeaveLimit}
                  className={`inline-flex items-center gap-1.5 px-5 py-2 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer ${
                    isOverLeaveLimit
                      ? 'bg-slate-400 cursor-not-allowed opacity-70'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {loading ? '保存中...' : event ? '更新する' : '登録する'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
