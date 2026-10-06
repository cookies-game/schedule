import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { X, Calendar as CalendarIcon, Users, Check } from 'lucide-react';
import { getDisplayUsername } from '../utils/authHelper';

interface CreateCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; color: string; memberUsernames: string[] }) => Promise<void>;
  user: User;
}

const PRESET_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#475569', // Slate
];

export const CreateCalendarModal: React.FC<CreateCalendarModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [memberUsernamesInput, setMemberUsernamesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUsername = getDisplayUsername(user.email, user.displayName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const memberUsernames = memberUsernamesInput
        .split(/[\n,、]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && u.toLowerCase() !== currentUsername.toLowerCase());

      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        color,
        memberUsernames,
      });

      setName('');
      setDescription('');
      setMemberUsernamesInput('');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'カレンダーの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">新しいカレンダーを作成</h2>
              <p className="text-xs text-slate-500">あなたが管理者（オーナー）となります</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              カレンダー名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 開発チーム、営業部、プロジェクトA"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">説明 (任意)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このカレンダーの用途や共有対象など"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">テーマカラー</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition ring-2 ring-offset-2 ring-transparent active:scale-95"
                >
                  {color === c && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                共有するメンバーのユーザーネーム (後からでも追加可能)
              </span>
            </label>
            <textarea
              rows={2}
              value={memberUsernamesInput}
              onChange={(e) => setMemberUsernamesInput(e.target.value)}
              placeholder="tanaka, sato, yuki (カンマまたは改行区切り)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              ※招待されたメンバーはカレンダーの閲覧・自分の予定登録ができます。
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? '作成中...' : 'カレンダーを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
