import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Memo, Calendar as CalendarType } from '../types';
import {
  FileText,
  Plus,
  Pin,
  Calendar as CalendarIcon,
  Search,
  Tag,
  Share2,
  Trash2,
  Edit2,
  Sparkles,
  ExternalLink,
  Users,
} from 'lucide-react';
import { getDisplayUsername, extractUsernameFromEmail } from '../utils/authHelper';

interface MemoListProps {
  user: User;
  memos: Memo[];
  calendars?: CalendarType[];
  currentCalendar?: CalendarType | null;
  onOpenCreateMemo: (initialDate?: string) => void;
  onEditMemo: (memo: Memo) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  onSelectCalendar?: (calendarId: string) => void;
}

const CATEGORIES = ['すべて', 'メモ', 'TODO', '議事録', 'アイデア', '連絡・共有', 'その他'];

export const MemoList: React.FC<MemoListProps> = ({
  user,
  memos,
  calendars = [],
  currentCalendar,
  onOpenCreateMemo,
  onEditMemo,
  onDeleteMemo,
  onSelectCalendar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [selectedCalFilter, setSelectedCalFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentUsername =
    extractUsernameFromEmail(user.email) ||
    getDisplayUsername(user.email, user.displayName);

  // Filter memos
  const filteredMemos = memos.filter((m) => {
    // If in calendar view, only show memos linked to this calendar
    if (currentCalendar && m.linkedCalendarId && m.linkedCalendarId !== currentCalendar.id) {
      return false;
    }

    // Calendar filter on global dashboard
    if (!currentCalendar && selectedCalFilter !== 'all') {
      if (selectedCalFilter === 'unlinked' && m.linkedCalendarId) return false;
      if (selectedCalFilter !== 'unlinked' && m.linkedCalendarId !== selectedCalFilter) return false;
    }

    // Category filter
    if (selectedCategory !== 'すべて' && m.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchContent = m.content.toLowerCase().includes(q);
      const matchCategory = m.category?.toLowerCase().includes(q);
      const matchCal = m.linkedCalendarName?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchCategory && !matchCal) return false;
    }

    return true;
  });

  // Separate pinned and unpinned
  const pinnedMemos = filteredMemos.filter((m) => m.isPinned);
  const regularMemos = filteredMemos.filter((m) => !m.isPinned);

  const handleDelete = async (memoId: string) => {
    try {
      await onDeleteMemo(memoId);
      setDeletingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const renderMemoCard = (memo: Memo) => {
    const isOwnerOrCreator =
      memo.creatorId === user.uid ||
      memo.creatorUsername?.toLowerCase() === currentUsername.toLowerCase() ||
      (memo.creatorEmail && user.email && memo.creatorEmail.toLowerCase() === user.email.toLowerCase());

    const isConfirming = deletingId === memo.id;

    return (
      <div
        key={memo.id}
        style={{ backgroundColor: memo.color && memo.color !== '#ffffff' ? memo.color : '#ffffff' }}
        className="rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative"
      >
        <div>
          {/* Top meta bar */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {memo.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 text-slate-700 text-[10px] font-bold">
                  <Tag className="w-2.5 h-2.5 text-slate-500" />
                  <span>{memo.category}</span>
                </span>
              )}

              {memo.isPinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold">
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  <span>ピン留め</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onEditMemo(memo)}
                title="編集"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-black/5 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {isConfirming ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(memo.id)}
                    className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-lg shadow-2xs hover:bg-rose-700 cursor-pointer"
                  >
                    削除
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeletingId(memo.id)}
                  title="削除"
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <h3
            onClick={() => onEditMemo(memo)}
            className="text-sm sm:text-base font-bold text-slate-900 mb-2 hover:text-indigo-600 transition cursor-pointer leading-snug"
          >
            {memo.title}
          </h3>

          {/* Content snippet */}
          {memo.content && (
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono line-clamp-5 mb-4 bg-black/[0.02] p-2.5 rounded-xl border border-black/[0.03]">
              {memo.content}
            </p>
          )}
        </div>

        {/* Footer info: linked calendar, date, sharing */}
        <div className="pt-3 border-t border-black/[0.06] space-y-2 mt-2 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            {/* Linked Calendar badge */}
            {memo.linkedCalendarId ? (
              <button
                type="button"
                onClick={() => {
                  if (onSelectCalendar && memo.linkedCalendarId) {
                    onSelectCalendar(memo.linkedCalendarId);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition cursor-pointer border border-indigo-100"
              >
                <CalendarIcon className="w-3 h-3 text-indigo-500" />
                <span>{memo.linkedCalendarName || 'カレンダー連携'}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            ) : (
              <span className="text-slate-400">カレンダー未連携</span>
            )}

            {/* Linked Date badge */}
            {memo.linkedDate && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <span>🗓️ {memo.linkedDate}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span>作成者: @{memo.creatorUsername || memo.creatorName}</span>

            {memo.sharedWithUsernames && memo.sharedWithUsernames.length > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                <Share2 className="w-2.5 h-2.5" />
                <span>共有: {memo.sharedWithUsernames.length}名</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メモを検索（タイトル、内容、カテゴリー）..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
          />
        </div>

        {/* Add Memo Button */}
        <button
          onClick={() => onOpenCreateMemo()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>新しいメモを作成</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Calendar Filter (if not inside calendar view) */}
        {!currentCalendar && calendars.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">カレンダー:</span>
            <select
              value={selectedCalFilter}
              onChange={(e) => setSelectedCalFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
            >
              <option value="all">すべてのカレンダー</option>
              <option value="unlinked">カレンダー未連携のみ</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  📅 {cal.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredMemos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">メモはまだありません</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            カレンダーと連携したメモや、チームメンバーと共有するTODO・議事録などを手軽に作成できます。
          </p>
          <button
            onClick={() => onOpenCreateMemo()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>メモを作成する</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Memos */}
          {pinnedMemos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Pin className="w-3.5 h-3.5 fill-current text-amber-600" />
                <span>ピン留めされたメモ ({pinnedMemos.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedMemos.map(renderMemoCard)}
              </div>
            </div>
          )}

          {/* Regular Memos */}
          {regularMemos.length > 0 && (
            <div className="space-y-3">
              {pinnedMemos.length > 0 && (
                <div className="text-xs font-bold text-slate-500">
                  すべてのメモ ({regularMemos.length})
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {regularMemos.map(renderMemoCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
