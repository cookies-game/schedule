import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType, ScheduleEvent, PaidLeaveBalance } from '../types';
import {
  Palmtree,
  Calendar as CalendarIcon,
  Plus,
  Shield,
  Edit2,
  Check,
  CheckCircle2,
  CalendarCheck2,
  User as UserIcon,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  getDisplayUsername,
  extractUsernameFromEmail,
  getUserIdentifiers,
  usernameToEmail,
  calculateUserLeaveStats,
  formatDateToYYYYMMDD,
} from '../utils/authHelper';

interface PaidLeaveManagerProps {
  calendar: CalendarType;
  currentUser: User;
  events: ScheduleEvent[];
  balances: Record<string, PaidLeaveBalance>;
  isEffectiveAdmin?: boolean;
  onUpdateGrant: (userId: string, granted: number, userEmail: string, userName: string) => Promise<void>;
  onOpenNewLeaveModal: (targetUserId?: string, targetUserName?: string, targetUserEmail?: string) => void;
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
}

export const PaidLeaveManager: React.FC<PaidLeaveManagerProps> = ({
  calendar,
  currentUser,
  events,
  balances,
  isEffectiveAdmin,
  onUpdateGrant,
  onOpenNewLeaveModal,
  onEditEvent,
  onDeleteEvent,
}) => {
  const currentUsername = getDisplayUsername(currentUser.email, currentUser.displayName);
  const loginUsername = extractUsernameFromEmail(currentUser.email);

  const realIsOwner =
    calendar.ownerId === currentUser.uid ||
    (calendar.ownerEmail && currentUser.email && calendar.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (calendar.ownerUsername && currentUsername && calendar.ownerUsername.toLowerCase() === currentUsername.toLowerCase()) ||
    (calendar.ownerUsername && loginUsername && calendar.ownerUsername.toLowerCase() === loginUsername.toLowerCase());

  const isOwner = isEffectiveAdmin !== undefined ? isEffectiveAdmin : realIsOwner;

  // Editing granted days inline state (admin only)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGrantedVal, setEditGrantedVal] = useState<number>(20);
  const [filterMember, setFilterMember] = useState<string>('all');
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

  // List of all members in calendar
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
      email: usernameToEmail(uname),
      isOwner: false,
    })),
  ];

  const nonOwnerMembers = members.filter((m) => !m.isOwner);
  const [perspectiveMemberId, setPerspectiveMemberId] = useState<string>(
    nonOwnerMembers[0]?.id || members[0]?.id || ''
  );

  // If admin is previewing in member perspective, evaluate 'you' as the selected member
  const isPreviewingAsMember = realIsOwner && !isOwner;
  const viewingTarget = isPreviewingAsMember
    ? (members.find((m) => m.id === perspectiveMemberId) || nonOwnerMembers[0] || members[0])
    : {
        id: currentUser.uid,
        name: currentUsername,
        email: currentUser.email || '',
        isOwner: realIsOwner,
      };

  // Filter paid leave events only
  const paidLeaveEvents = events.filter((e) => e.isPaidLeave);

  // Calculate used days per member
  const getUsedDays = (memberId: string, memberName?: string, memberEmail?: string) => {
    const rawIdentifiers = getUserIdentifiers(memberId, memberEmail, memberName, memberName);
    if (memberId) rawIdentifiers.push(memberId.toLowerCase());
    if (memberName) rawIdentifiers.push(memberName.toLowerCase());
    if (memberEmail) {
      rawIdentifiers.push(memberEmail.toLowerCase());
      const u = extractUsernameFromEmail(memberEmail);
      if (u) rawIdentifiers.push(u.toLowerCase());
    }

    return paidLeaveEvents
      .filter((e) => {
        const targetAliases = [
          e.targetUserId?.toLowerCase(),
          e.targetUserName?.toLowerCase(),
          e.targetUserEmail?.toLowerCase(),
          extractUsernameFromEmail(e.targetUserEmail)?.toLowerCase(),
        ].filter(Boolean);

        return rawIdentifiers.some((id) => targetAliases.includes(id));
      })
      .reduce((acc, curr) => acc + (curr.paidLeaveDays || 1), 0);
  };

  // Get granted days per member (checks UID, username, email, or matches in balance collection)
  const getGrantedDays = (memberId: string, memberName?: string, memberEmail?: string) => {
    const rawIdentifiers = getUserIdentifiers(memberId, memberEmail, memberName, memberName);
    if (memberId) rawIdentifiers.push(memberId.toLowerCase());
    if (memberName) rawIdentifiers.push(memberName.toLowerCase());
    if (memberEmail) {
      rawIdentifiers.push(memberEmail.toLowerCase());
      const uFromEmail = extractUsernameFromEmail(memberEmail);
      if (uFromEmail) rawIdentifiers.push(uFromEmail.toLowerCase());
    }

    // 1. Direct key match
    for (const key of rawIdentifiers) {
      if (balances[key]?.totalGranted !== undefined) {
        return balances[key].totalGranted;
      }
    }

    // 2. Case-insensitive search through all balance documents
    for (const b of Object.values(balances)) {
      if (b.totalGranted !== undefined) {
        const bAliases = [
          b.userId?.toLowerCase(),
          b.userName?.toLowerCase(),
          b.userEmail?.toLowerCase(),
          extractUsernameFromEmail(b.userEmail)?.toLowerCase(),
        ].filter(Boolean);

        if (rawIdentifiers.some((id) => bAliases.includes(id))) {
          return b.totalGranted;
        }
      }
    }

    return 20; // default only if never set
  };

  const [showPastLeaves, setShowPastLeaves] = useState(false);
  const todayStr = formatDateToYYYYMMDD(new Date());

  // Evaluated user's stats
  const viewingStats = calculateUserLeaveStats(
    viewingTarget.id,
    viewingTarget.name,
    viewingTarget.email,
    events,
    balances
  );
  const myUsed = viewingStats.used;
  const myGranted = viewingStats.granted;
  const myRemaining = viewingStats.remaining;
  const myUsageRate = myGranted > 0 ? Math.round((myUsed / myGranted) * 100) : 0;

  // Sorted upcoming paid leave list
  const sortedLeaves = [...paidLeaveEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const filteredLeaves = sortedLeaves.filter((l) => {
    // 日付が過ぎた有給は自動で非表示 (有給残数は減ったまま保持される)
    if (!showPastLeaves && l.endDate < todayStr) return false;
    if (filterMember === 'all') return true;
    return (
      l.targetUserId === filterMember ||
      l.targetUserEmail === filterMember ||
      (l.targetUserName && l.targetUserName.toLowerCase() === filterMember.toLowerCase())
    );
  });

  const handleSaveGrant = async (memberId: string, email: string, name: string) => {
    if (isNaN(editGrantedVal) || editGrantedVal < 0) return;
    await onUpdateGrant(memberId, editGrantedVal, email, name);
    setEditingUserId(null);
  };

  const handleExecuteDeleteLeave = async (leaveId: string) => {
    if (!onDeleteEvent) return;
    try {
      await onDeleteEvent(leaveId);
      setDeletingLeaveId(null);
    } catch (err) {
      console.error('有給削除エラー:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: My Remaining Days */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-100 flex items-center gap-1.5">
                <Palmtree className="w-4 h-4" />
                {isPreviewingAsMember ? `${viewingTarget.name}さんの有給残数` : 'あなたの有給残数'}
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                {isPreviewingAsMember ? '目線プレビュー' : '個人'}
              </span>
            </div>

            {isPreviewingAsMember && nonOwnerMembers.length > 0 && (
              <div className="mb-2.5">
                <div className="flex items-center gap-1 text-[10px] text-emerald-100 mb-1">
                  <Eye className="w-3 h-3" />
                  <span>プレビュー対象メンバー:</span>
                </div>
                <select
                  value={perspectiveMemberId}
                  onChange={(e) => setPerspectiveMemberId(e.target.value)}
                  className="w-full text-xs bg-white/20 text-white rounded-lg px-2 py-1 border border-white/30 focus:outline-none focus:bg-emerald-800"
                >
                  {nonOwnerMembers.map((m) => (
                    <option key={m.id} value={m.id} className="text-slate-800">
                      @{m.name} の視点
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-extrabold">{myRemaining}</span>
              <span className="text-sm font-semibold text-emerald-100">日</span>
            </div>
            <div className="text-xs text-emerald-100 flex items-center justify-between pt-2 border-t border-white/20">
              <span>付与: {myGranted}日</span>
              <span>取得: {myUsed}日</span>
            </div>
          </div>
        </div>

        {/* Card 2: My Usage Progress */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">
                {isPreviewingAsMember ? `${viewingTarget.name}さんの有給消化率` : 'あなたの有給消化率'}
              </span>
              <span className="text-xs font-bold text-slate-700">{myUsageRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, myUsageRate)}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => onOpenNewLeaveModal(viewingTarget.id, viewingTarget.name, viewingTarget.email || undefined)}
            className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>有給休暇を申請・登録</span>
          </button>
        </div>

        {/* Card 3: Team Total PTO planned */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">チーム全体の有給取得数</span>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-slate-800">
                {paidLeaveEvents.reduce((acc, curr) => acc + (curr.paidLeaveDays || 1), 0)}
              </span>
              <span className="text-xs text-slate-400">日 (合計)</span>
            </div>
            <span className="text-[11px] text-slate-400">登録済み予定: {paidLeaveEvents.length} 件</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-medium pt-2 border-t border-slate-100 flex items-center gap-1">
            <CalendarCheck2 className="w-3.5 h-3.5" />
            <span>予定はカレンダーにも表示されます</span>
          </div>
        </div>

        {/* Card 4: Role Permissions Info */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-800">有給管理の権限</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {isOwner ? (
                <strong className="text-amber-800">
                  あなたは管理者です。全員の有給やスケジュールの変更・削除、付与日数の設定が可能です。
                </strong>
              ) : (
                <span>
                  メンバー権限です。自分の有給・スケジュールのみ登録・変更・削除が可能です。
                </span>
              )}
            </p>
          </div>
          {isOwner && (
            <div className="text-[10px] bg-amber-100/60 text-amber-800 px-2 py-1 rounded-md mt-2 font-medium">
              ★ 付与日数は下の表から変更できます
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Member Paid Leave Balance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-emerald-600" />
              メンバー別 有給残数・付与状況
            </h2>
            <p className="text-xs text-slate-400">各メンバーの有給付与日数と現在の残り日数一覧</p>
          </div>

          <button
            onClick={() => onOpenNewLeaveModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>有給休暇を登録</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">メンバー</th>
                <th className="py-3 px-4">権限</th>
                <th className="py-3 px-4">付与日数</th>
                <th className="py-3 px-4">取得済み</th>
                <th className="py-3 px-4">残り有給日数</th>
                <th className="py-3 px-4 text-right">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const memberStats = calculateUserLeaveStats(
                  member.id,
                  member.name,
                  member.email,
                  events,
                  balances
                );
                const used = memberStats.used;
                const granted = memberStats.granted;
                const remaining = memberStats.remaining;
                const isEditing = editingUserId === member.id;
                const isCurrent =
                  member.id === viewingTarget.id ||
                  member.name.toLowerCase() === viewingTarget.name.toLowerCase() ||
                  (viewingTarget.email && member.email.toLowerCase() === viewingTarget.email.toLowerCase()) ||
                  member.id === currentUser.uid ||
                  member.name.toLowerCase() === currentUsername.toLowerCase() ||
                  (loginUsername && member.name.toLowerCase() === loginUsername.toLowerCase()) ||
                  (currentUser.email && member.email.toLowerCase() === currentUser.email.toLowerCase());

                return (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {member.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <span>{member.name}</span>
                            {isCurrent && <span className="text-[10px] text-slate-400">(あなた)</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">@{member.name}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {member.isOwner ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Shield className="w-2.5 h-2.5" />
                          管理者
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          メンバー
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={editGrantedVal}
                            onChange={(e) => setEditGrantedVal(parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleSaveGrant(member.id, member.email, member.name)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">{granted} 日</span>
                          {isOwner && (
                            <button
                              onClick={() => {
                                setEditingUserId(member.id);
                                setEditGrantedVal(granted);
                              }}
                              title="付与日数を編集"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-600">{used} 日</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                            remaining <= 2
                              ? 'bg-rose-100 text-rose-800'
                              : remaining <= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          残り {remaining} 日
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {(isOwner || isCurrent) && (
                        <button
                          onClick={() => onOpenNewLeaveModal(member.id, member.name, member.email)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                        >
                          + 有給登録
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Paid Leave Schedule List (誰が何月何日に有給を取るか) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              有給休暇の取得予定・履歴一覧
            </h2>
            <p className="text-xs text-slate-400">
              ※有給を設定した日が過ぎると自動で非表示になります（有給残数は減ったまま保持されます）
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 transition">
              <input
                type="checkbox"
                checked={showPastLeaves}
                onChange={(e) => setShowPastLeaves(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span>過去の有給履歴も表示</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">絞り込み:</span>
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">全員の有給</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredLeaves.length === 0 ? (
          <div className="text-center py-12 p-6">
            <Palmtree className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">有給休暇の登録はありません</p>
            <p className="text-[11px] text-slate-400 mt-1">「有給休暇を登録」ボタンから有給の予定を追加できます。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">取得日 (日程)</th>
                  <th className="py-3 px-4">取得者 (誰が)</th>
                  <th className="py-3 px-4">取得区分</th>
                  <th className="py-3 px-4">タイトル / 理由</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeaves.map((leave) => {
                  const isMyLeave =
                    leave.targetUserId === currentUser.uid ||
                    leave.creatorId === currentUser.uid ||
                    (leave.targetUserName && currentUsername && leave.targetUserName.toLowerCase() === currentUsername.toLowerCase()) ||
                    (leave.targetUserEmail && currentUser.email && leave.targetUserEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                    (leave.creatorEmail && currentUser.email && leave.creatorEmail.toLowerCase() === currentUser.email.toLowerCase());

                  const canEditThis = isOwner || isMyLeave;
                  const isPast = leave.endDate < new Date().toISOString().split('T')[0];
                  const isConfirming = deletingLeaveId === leave.id;

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{leave.startDate}</span>
                          {leave.endDate !== leave.startDate && (
                            <>
                              <span className="text-slate-400">〜</span>
                              <span>{leave.endDate}</span>
                            </>
                          )}
                          {isPast && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                              取得済
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{leave.targetUserName}</span>
                          <span className="text-[11px] text-slate-400">(@{leave.targetUserName})</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {leave.paidLeaveDays === 0.5 ? '半日 (半休)' : '1日 (全休)'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700">{leave.title}</div>
                        {leave.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{leave.description}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditEvent(leave)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              canEditThis
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            {canEditThis ? '編集・変更' : '詳細'}
                          </button>

                          {canEditThis && onDeleteEvent && (
                            isConfirming ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleExecuteDeleteLeave(leave.id)}
                                  className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition cursor-pointer"
                                >
                                  削除実行
                                </button>
                                <button
                                  onClick={() => setDeletingLeaveId(null)}
                                  className="px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-200 rounded transition cursor-pointer"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingLeaveId(leave.id)}
                                title="有給を削除"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
