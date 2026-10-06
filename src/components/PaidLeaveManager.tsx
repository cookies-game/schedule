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
} from 'lucide-react';
import { getDisplayUsername } from '../utils/authHelper';

interface PaidLeaveManagerProps {
  calendar: CalendarType;
  currentUser: User;
  events: ScheduleEvent[];
  balances: Record<string, PaidLeaveBalance>;
  onUpdateGrant: (userId: string, granted: number, userEmail: string, userName: string) => Promise<void>;
  onOpenNewLeaveModal: (targetUserId?: string, targetUserName?: string, targetUserEmail?: string) => void;
  onEditEvent: (event: ScheduleEvent) => void;
}

export const PaidLeaveManager: React.FC<PaidLeaveManagerProps> = ({
  calendar,
  currentUser,
  events,
  balances,
  onUpdateGrant,
  onOpenNewLeaveModal,
  onEditEvent,
}) => {
  const isOwner = calendar.ownerId === currentUser.uid;

  // Editing granted days inline state (admin only)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGrantedVal, setEditGrantedVal] = useState<number>(20);
  const [filterMember, setFilterMember] = useState<string>('all');

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
      email: uname,
      isOwner: false,
    })),
  ];

  // Filter paid leave events only
  const paidLeaveEvents = events.filter((e) => e.isPaidLeave);

  // Calculate used days per member
  const getUsedDays = (memberId: string, memberEmail: string) => {
    return paidLeaveEvents
      .filter((e) => e.targetUserId === memberId || e.targetUserEmail?.toLowerCase() === memberEmail.toLowerCase())
      .reduce((acc, curr) => acc + (curr.paidLeaveDays || 1), 0);
  };

  // Get granted days per member (default 20 if not set)
  const getGrantedDays = (memberId: string) => {
    return balances[memberId]?.totalGranted ?? 20;
  };

  // Current user's stats
  const myUsed = getUsedDays(currentUser.uid, currentUser.email || '');
  const myGranted = getGrantedDays(currentUser.uid);
  const myRemaining = Math.max(0, myGranted - myUsed);
  const myUsageRate = myGranted > 0 ? Math.round((myUsed / myGranted) * 100) : 0;

  // Sorted upcoming paid leave list
  const sortedLeaves = [...paidLeaveEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const filteredLeaves = sortedLeaves.filter((l) => {
    if (filterMember === 'all') return true;
    return l.targetUserId === filterMember || l.targetUserEmail === filterMember;
  });

  const handleSaveGrant = async (memberId: string, email: string, name: string) => {
    if (isNaN(editGrantedVal) || editGrantedVal < 0) return;
    await onUpdateGrant(memberId, editGrantedVal, email, name);
    setEditingUserId(null);
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
                あなたの有給残数
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">個人</span>
            </div>
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
              <span className="text-xs font-semibold text-slate-500">あなたの有給消化率</span>
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
            onClick={() => onOpenNewLeaveModal(currentUser.uid, currentUser.displayName || undefined, currentUser.email || undefined)}
            className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
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
                  あなたは管理者です。全メンバーの有給付与日数の設定や有給の変更・削除が可能です。
                </strong>
              ) : (
                <span>
                  メンバー権限です。自分の有給予定のみ登録・編集・削除が可能です。
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
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
                const used = getUsedDays(member.id, member.email);
                const granted = getGrantedDays(member.id);
                const remaining = Math.max(0, granted - used);
                const isEditing = editingUserId === member.id;
                const isCurrent = member.id === currentUser.uid || member.email.toLowerCase() === currentUser.email?.toLowerCase();

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
                          <div className="text-[11px] text-slate-400">{member.email}</div>
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
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
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
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
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
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
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
              有給休暇の取得予定・履歴一覧 (誰が何月何日に取得するか)
            </h2>
            <p className="text-xs text-slate-400">チームメンバー全員の有給スケジュール</p>
          </div>

          <div className="flex items-center gap-2">
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
                  const canEditThis = isOwner || leave.targetUserId === currentUser.uid;
                  const isPast = leave.endDate < new Date().toISOString().split('T')[0];

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
                          <span className="text-[11px] text-slate-400">({leave.targetUserEmail})</span>
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
                        <button
                          onClick={() => onEditEvent(leave)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            canEditThis
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {canEditThis ? '編集・変更' : '詳細'}
                        </button>
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
