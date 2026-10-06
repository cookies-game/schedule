import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar as CalendarType } from '../types';
import {
  Calendar as CalendarIcon,
  Plus,
  Users,
  Shield,
  Trash2,
  Share2,
  Clock,
  Search,
  Sparkles,
} from 'lucide-react';

import { getDisplayUsername } from '../utils/authHelper';

interface CalendarListProps {
  user: User;
  calendars: CalendarType[];
  onSelectCalendar: (calendar: CalendarType) => void;
  onOpenCreateModal: () => void;
  onDeleteCalendar: (calendarId: string) => void;
  onShareCalendar: (calendar: CalendarType) => void;
}

export const CalendarList: React.FC<CalendarListProps> = ({
  user,
  calendars,
  onSelectCalendar,
  onOpenCreateModal,
  onDeleteCalendar,
  onShareCalendar,
}) => {
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCalendars = calendars.filter((cal) => {
    const isOwner = cal.ownerId === user.uid;
    const matchesFilter =
      filter === 'all' || (filter === 'owned' && isOwner) || (filter === 'shared' && !isOwner);
    const matchesSearch =
      cal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cal.description && cal.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const ownedCount = calendars.filter((c) => c.ownerId === user.uid).length;
  const sharedCount = calendars.filter((c) => c.ownerId !== user.uid).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero / Header banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold backdrop-blur-xs mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>マルチカレンダー & 有給管理システム</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            スケジュール & 有給休暇カレンダー
          </h1>
          <p className="text-indigo-200 text-sm leading-relaxed mb-6">
            Googleスライドのように複数のカレンダーを作成して使い分けたり、チームメンバーと共有してスケジュールや有給取得をリアルタイムに管理できます。
          </p>

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-950 font-bold text-sm hover:bg-indigo-50 transition shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>新しいカレンダーを作成</span>
          </button>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-8">
          <CalendarIcon className="w-80 h-80" />
        </div>
      </div>

      {/* Filter bar & search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            すべて ({calendars.length})
          </button>
          <button
            onClick={() => setFilter('owned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'owned'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            自分が作成・管理者 ({ownedCount})
          </button>
          <button
            onClick={() => setFilter('shared')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'shared'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            共有されたカレンダー ({sharedCount})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="カレンダーを検索..."
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Calendar Grid */}
      {filteredCalendars.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">カレンダーが見つかりません</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            {searchQuery
              ? '検索条件に一致するカレンダーがありません。'
              : '「新しいカレンダーを作成」ボタンから新しいカレンダーを作成してみましょう！'}
          </p>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>カレンダーを作成する</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCalendars.map((cal) => {
            const isOwner = cal.ownerId === user.uid;
            const memberCount = (cal.memberIds?.length || 0) + 1; // including owner

            return (
              <div
                key={cal.id}
                className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 ring-4 ring-slate-100"
                        style={{ backgroundColor: cal.color || '#4f46e5' }}
                      />
                      <h2
                        onClick={() => onSelectCalendar(cal)}
                        className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition cursor-pointer truncate max-w-[200px]"
                      >
                        {cal.name}
                      </h2>
                    </div>

                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        <Shield className="w-3 h-3" />
                        管理者
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                        メンバー
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                    {cal.description || '説明なし'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{memberCount} 人参加</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      <span>
                        作成者: {isOwner ? 'あなた' : cal.ownerUsername || cal.ownerName || getDisplayUsername(cal.ownerEmail, null)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectCalendar(cal)}
                      className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition text-center"
                    >
                      カレンダーを開く
                    </button>

                    <button
                      onClick={() => onShareCalendar(cal)}
                      title="メンバー共有・確認"
                      className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {isOwner && (
                      <button
                        onClick={() => onDeleteCalendar(cal.id)}
                        title="カレンダーを削除"
                        className="p-2 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
