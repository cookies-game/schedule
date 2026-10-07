import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType, Memo } from '../types';
import {
  X,
  FileText,
  Calendar as CalendarIcon,
  Pin,
  Trash2,
  Check,
  Tag,
  AlertCircle,
  Users,
  UserPlus,
  Share2,
} from 'lucide-react';
import { getDisplayUsername, extractUsernameFromEmail } from '../utils/authHelper';

interface MemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  memo: Memo | null;
  initialDate?: string;
  calendar?: CalendarType | null;
  calendars?: CalendarType[];
  currentUser: User;
  onSave: (memoData: Omit<Memo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete?: (memoId: string) => Promise<void>;
}

const MEMO_COLORS = [
  '#ffffff', // White/Default
  '#fef3c7', // Amber/Yellow
  '#dcfce7', // Emerald/Green
  '#e0e7ff', // Indigo/Blue
  '#f3e8ff', // Purple
  '#ffe4e6', // Rose
  '#e2e8f0', // Slate/Gray
];

const PRESET_CATEGORIES = ['メモ', 'TODO', '議事録', 'アイデア', '連絡・共有', 'その他'];

export const MemoModal: React.FC<MemoModalProps> = ({
  isOpen,
  onClose,
  memo,
  initialDate,
  calendar,
  calendars = [],
  currentUser,
  onSave,
  onDelete,
}) => {
  const currentUsername =
    extractUsernameFromEmail(currentUser.email) ||
    getDisplayUsername(currentUser.email, currentUser.displayName);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);

  // Calendar Linking
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    calendar?.id || ''
  );
  const [linkedDate, setLinkedDate] = useState<string>(initialDate || '');
  const [hasLinkedDate, setHasLinkedDate] = useState<boolean>(!!initialDate);

  // Sharing with other usernames
  const [sharedUsernames, setSharedUsernames] = useState<string[]>([]);
  const [newShareUsername, setNewShareUsername] = useState('');

  const [color, setColor] = useState(MEMO_COLORS[0]);
  const [isPinned, setIsPinned] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (memo) {
      setTitle(memo.title);
      setContent(memo.content);
      setCategory(memo.category || PRESET_CATEGORIES[0]);
      setSelectedCalendarId(memo.linkedCalendarId || memo.calendarId || '');
      setLinkedDate(memo.linkedDate || '');
      setHasLinkedDate(!!memo.linkedDate);
      setSharedUsernames(memo.sharedWithUsernames || []);
      setColor(memo.color || MEMO_COLORS[0]);
      setIsPinned(!!memo.isPinned);
    } else {
      setTitle('');
      setContent('');
      setCategory(PRESET_CATEGORIES[0]);
      setSelectedCalendarId(calendar?.id || '');
      setLinkedDate(initialDate || '');
      setHasLinkedDate(!!initialDate);
      setSharedUsernames([]);
      setColor(MEMO_COLORS[0]);
      setIsPinned(false);
    }
    setError(null);
  }, [memo, initialDate, calendar, isOpen]);

  if (!isOpen) return null;

  // Add username to shared list
  const handleAddShareUsername = () => {
    const trimmed = newShareUsername.trim().toLowerCase().replace(/^@/, '');
    if (!trimmed) return;
    if (trimmed === currentUsername.toLowerCase()) {
      setError('自分自身以外のユーザーネームを指定してください。');
      return;
    }
    if (!sharedUsernames.includes(trimmed)) {
      setSharedUsernames([...sharedUsernames, trimmed]);
    }
    setNewShareUsername('');
  };

  const handleRemoveShareUsername = (uname: string) => {
    setSharedUsernames(sharedUsernames.filter((u) => u !== uname));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const activeCal = calendars.find((c) => c.id === selectedCalendarId) || calendar || null;

      await onSave({
        title: title.trim(),
        content: content.trim(),
        category,
        calendarId: selectedCalendarId || '',
        linkedCalendarId: selectedCalendarId || '',
        linkedCalendarName: activeCal ? activeCal.name : '',
        linkedDate: hasLinkedDate && linkedDate ? linkedDate : '',
        sharedWithUsernames: sharedUsernames,
        color,
        isPinned,
        creatorId: currentUser.uid,
        creatorUsername: currentUsername,
        creatorName: currentUser.displayName || currentUsername,
        creatorEmail: currentUser.email || '',
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'メモの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!memo || !onDelete) return;

    setLoading(true);
    try {
      await onDelete(memo.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'メモの削除に失敗しました');
      setIsConfirmingDelete(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div
        style={{ backgroundColor: color !== '#ffffff' ? color : '#ffffff' }}
        className="w-full max-w-xl rounded-3xl p-6 shadow-2xl transition-all border border-slate-200 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {memo ? 'メモの編集' : '新しいメモを作成'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                カレンダー連携 & メンバーアカウント共有
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? 'ピン留め解除' : '上部にピン留め'}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isPinned
                  ? 'bg-amber-100 text-amber-700 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              タイトル <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: ミーティング議事録、重要TODO、開発引継ぎメモ"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white/95 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
            />
          </div>

          {/* Category & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                カテゴリー
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              >
                {PRESET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                カラーラベル
              </label>
              <div className="flex items-center gap-1.5 pt-1">
                {MEMO_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition border border-slate-300 ring-2 ring-offset-1 ring-transparent hover:scale-105 cursor-pointer shadow-2xs"
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-slate-700 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Calendar Linking */}
          <div className="p-3.5 bg-white/90 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                <span>カレンダーと連携する</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  連携先カレンダー
                </label>
                <select
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">連携カレンダーなし（個人・共有メモ）</option>
                  {(calendars.length > 0 ? calendars : calendar ? [calendar] : []).map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      📅 {cal.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasLinkedDate}
                    onChange={(e) => {
                      setHasLinkedDate(e.target.checked);
                      if (e.target.checked && !linkedDate) {
                        setLinkedDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>特定の日付と連携</span>
                </label>
                {hasLinkedDate ? (
                  <input
                    type="date"
                    value={linkedDate}
                    onChange={(e) => setLinkedDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  />
                ) : (
                  <div className="text-[11px] text-slate-400 py-1.5">日付未指定（全体メモ）</div>
                )}
              </div>
            </div>

            {hasLinkedDate && (
              <p className="text-[10px] text-indigo-600 font-medium bg-indigo-50/60 p-2 rounded-xl">
                ★ 連携すると、カレンダーの該当日のマスにメモバッジが表示され、1クリックで開けます。
              </p>
            )}
          </div>

          {/* Section: Share with Other Accounts */}
          <div className="p-3.5 bg-white/90 rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>ほかのアカウントと共有</span>
              </label>
              <span className="text-[10px] text-slate-400">ユーザーネームで指定</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                  @
                </span>
                <input
                  type="text"
                  value={newShareUsername}
                  onChange={(e) => setNewShareUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddShareUsername();
                    }
                  }}
                  placeholder="共有相手のユーザーネーム"
                  className="w-full pl-6 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddShareUsername}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>追加</span>
              </button>
            </div>

            {sharedUsernames.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {sharedUsernames.map((uname) => (
                  <span
                    key={uname}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                  >
                    <span>@{uname}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveShareUsername(uname)}
                      className="text-emerald-500 hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                {selectedCalendarId
                  ? '※ 連携カレンダーの全メンバーに加えて、上記で追加したアカウントとも共有されます。'
                  : '※ 指定したアカウントの「メモ一覧」にもこのメモが表示・共有されます。'}
              </p>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              メモ内容
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="メモの詳細、タスクリスト、議事録、連絡事項などを入力..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white/95 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between shrink-0">
            {memo ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-1.5 bg-rose-50 p-1 px-2 rounded-xl border border-rose-200">
                  <span className="text-[11px] text-rose-700 font-bold">削除しますか？</span>
                  <button
                    type="button"
                    onClick={handleExecuteDelete}
                    disabled={loading}
                    className="px-2 py-0.5 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
                  >
                    {loading ? '削除中...' : 'はい、削除'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>このメモを削除</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-black/5 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? '保存中...' : memo ? '更新する' : '保存する'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
