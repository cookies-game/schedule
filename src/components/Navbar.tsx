import React from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Calendar as CalendarType, UserProfile } from '../types';
import { getDisplayUsername, extractUsernameFromEmail } from '../utils/authHelper';
import {
  Calendar as CalendarIcon,
  LogOut,
  Plus,
  ChevronRight,
  Layers,
  Shield,
  User as UserIcon,
  Settings,
  FileText,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  userProfile?: UserProfile | null;
  currentCalendar: CalendarType | null;
  onOpenAuth: () => void;
  onOpenCreateCalendar: () => void;
  onOpenCreateMemo?: () => void;
  onOpenSettings?: () => void;
  onBackToCalendarList: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  userProfile,
  currentCalendar,
  onOpenAuth,
  onOpenCreateCalendar,
  onOpenCreateMemo,
  onOpenSettings,
  onBackToCalendarList,
}) => {
  const isOwner = user && currentCalendar && currentCalendar.ownerId === user.uid;
  const username = user
    ? userProfile?.username || extractUsernameFromEmail(user.email) || getDisplayUsername(user.email, user.displayName)
    : '';
  const avatarSrc = userProfile?.photoURL || user?.photoURL;
  const displayName = userProfile?.displayName || user?.displayName || username;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToCalendarList}
            className="flex items-center gap-2 hover:opacity-80 transition group text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shadow-indigo-200">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-base tracking-tight flex items-center gap-1.5">
                Schedule
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                カレンダー・メモ & 有給管理
              </span>
            </div>
          </button>

          {currentCalendar && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <button
                onClick={onBackToCalendarList}
                className="hidden sm:flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 py-1 px-2 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>一覧に戻る</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentCalendar.color || '#4f46e5' }}
                />
                <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate max-w-[140px] sm:max-w-[200px]">
                  {currentCalendar.name}
                </span>
                {isOwner ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Shield className="w-2.5 h-2.5" />
                    管理者
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                    メンバー
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Quick Create Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenCreateCalendar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition border border-indigo-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">カレンダー作成</span>
                </button>

                {onOpenCreateMemo && (
                  <button
                    onClick={onOpenCreateMemo}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>メモ作成</span>
                  </button>
                )}
              </div>

              {/* User Profile & Account Settings Button */}
              <div className="flex items-center gap-1 sm:gap-2 pl-2 border-l border-slate-200">
                <button
                  onClick={onOpenSettings}
                  title="アカウント設定（表示名、ユーザーネーム、パスワード、プロフィール画像）"
                  className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 transition cursor-pointer text-left group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 overflow-hidden shrink-0 shadow-2xs">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (username[0] || 'U').toUpperCase()
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-semibold text-slate-800 truncate max-w-[110px] group-hover:text-indigo-600 transition">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">
                      @{username}
                    </p>
                  </div>
                  <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 hidden sm:block" />
                </button>

                <button
                  onClick={() => signOut(auth)}
                  title="ログアウト"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition shadow-indigo-100 cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>ログイン / アカウント作成</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
