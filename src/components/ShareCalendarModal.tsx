import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType } from '../types';
import { getDisplayUsername } from '../utils/authHelper';
import { X, Users, UserPlus, Shield, User as UserIcon, Trash2, CheckCircle2 } from 'lucide-react';

interface ShareCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: CalendarType;
  currentUser: User;
  onAddMemberUsername: (username: string) => Promise<void>;
  onRemoveMemberUsername: (username: string) => Promise<void>;
}

export const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({
  isOpen,
  onClose,
  calendar,
  currentUser,
  onAddMemberUsername,
  onRemoveMemberUsername,
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOwner = calendar.ownerId === currentUser.uid;
  const currentUsername = getDisplayUsername(currentUser.email, currentUser.displayName);
  const ownerUsername = calendar.ownerUsername || getDisplayUsername(calendar.ownerEmail, calendar.ownerName);

  // Combine member usernames
  const memberUsernames = calendar.memberUsernames && calendar.memberUsernames.length > 0
    ? calendar.memberUsernames
    : (calendar.memberEmails || []).map((e) => getDisplayUsername(e, null));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === ownerUsername.toLowerCase()) {
      setError('オーナーは既に追加されています。');
      return;
    }
    if (memberUsernames.map((u) => u.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError(`ユーザー「${trimmed}」は既に追加されています。`);
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await onAddMemberUsername(trimmed);
      setSuccess(`ユーザー「${trimmed}」を共有メンバーに追加しました。`);
      setNewUsername('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'メンバーの追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (usernameToRemove: string) => {
    if (!window.confirm(`「${usernameToRemove}」の共有を解除しますか？`)) return;

    setError(null);
    setSuccess(null);
    try {
      await onRemoveMemberUsername(usernameToRemove);
      setSuccess(`「${usernameToRemove}」の共有を解除しました。`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'メンバーの削除に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">カレンダー共有設定</h2>
              <p className="text-xs text-slate-500 font-medium">{calendar.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permissions explainer banner */}
        <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-950">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            権限とルールについて
          </div>
          <p className="text-[11px] leading-relaxed text-amber-800">
            • <strong>管理者（カレンダー作成者）</strong>：全員のスケジュールや有給を変更・削除できます。<br />
            • <strong>メンバー（共有相手）</strong>：自分のスケジュールのみ登録・変更・削除が可能です。
          </p>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {success}
          </div>
        )}

        {/* Add member form (only owner can add) */}
        {isOwner && (
          <form onSubmit={handleAdd} className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              新しいメンバーを招待 (ユーザーネーム)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="例: tanaka, sato, yuki"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !newUsername.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>招待</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ※追加したユーザーネームのアカウントでログインすると、自動的にこのカレンダーが表示されます。
            </p>
          </form>
        )}

        {/* Members list */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            参加メンバー一覧 ({1 + memberUsernames.length}名)
          </h3>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto border border-slate-100 rounded-xl">
            {/* Owner item */}
            <div className="flex items-center justify-between p-3 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  {ownerUsername[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>{ownerUsername}</span>
                    {calendar.ownerId === currentUser.uid && (
                      <span className="text-[10px] text-slate-400 font-normal">(あなた)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">@{ownerUsername}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Shield className="w-3 h-3" />
                管理者 (オーナー)
              </span>
            </div>

            {/* Invited member items */}
            {memberUsernames.length > 0 ? (
              memberUsernames.map((uname) => {
                const isCurrent = uname.toLowerCase() === currentUsername.toLowerCase();
                return (
                  <div key={uname} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {uname[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <span>{uname}</span>
                          {isCurrent && <span className="text-[10px] text-slate-400 font-normal">(あなた)</span>}
                        </div>
                        <div className="text-[11px] text-slate-400">@{uname}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        <UserIcon className="w-2.5 h-2.5" />
                        メンバー
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleRemove(uname)}
                          title="共有を解除"
                          className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                他のメンバーはまだ参加していません。ユーザーネームを入力して招待してください。
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
