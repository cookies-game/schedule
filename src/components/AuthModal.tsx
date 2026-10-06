import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../firebase';
import { usernameToEmail } from '../utils/authHelper';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Calendar as CalendarIcon,
  User,
  Lock,
  AlertCircle,
  Sparkles,
  ExternalLink,
  KeyRound,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isNotAllowedError, setIsNotAllowedError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const projectId = firebaseConfig.projectId;
  const authSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;

  const saveUserProfile = async (uid: string, userUsername: string, name?: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const email = usernameToEmail(userUsername);
      await setDoc(
        userRef,
        {
          uid,
          username: userUsername,
          email,
          displayName: name || userUsername,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsNotAllowedError(false);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const fallbackUsername = result.user.displayName || result.user.email?.split('@')[0] || 'ユーザー';
        await saveUserProfile(
          result.user.uid,
          fallbackUsername,
          result.user.displayName || fallbackUsername
        );
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Googleログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsNotAllowedError(false);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('ユーザーネームを入力してください。');
      return;
    }

    if (trimmedUsername.length < 2) {
      setError('ユーザーネームは2文字以上で入力してください。');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    if (isSignUp && password !== passwordConfirm) {
      setError('パスワードが一致しません。再度ご確認ください。');
      return;
    }

    setLoading(true);

    try {
      const internalEmail = usernameToEmail(trimmedUsername);
      const finalDisplayName = displayName.trim() || trimmedUsername;

      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, internalEmail, password);
        if (cred.user) {
          await updateProfile(cred.user, { displayName: finalDisplayName });
        }
        await saveUserProfile(cred.user.uid, trimmedUsername, finalDisplayName);
      } else {
        await signInWithEmailAndPassword(auth, internalEmail, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setIsNotAllowedError(true);
        setError('Firebaseコンソールで認証プロバイダが有効になっていません。');
      } else if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('ユーザーネームまたはパスワードが正しくありません。');
      } else if (err.code === 'auth/email-already-in-use') {
        setError(
          `ユーザーネーム「${trimmedUsername}」は既に登録されています。別のユーザーネームにするか、ログインをお試しください。`
        );
      } else if (err.code === 'auth/weak-password') {
        setError('パスワードは6文字以上で設定してください。');
      } else {
        setError(err.message || '認証エラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isSignUp ? 'アカウント作成 (サインアップ)' : 'ログイン (サインイン)'}
              </h2>
              <p className="text-xs text-slate-500">ユーザーネームとパスワードで認証</p>
            </div>
          </div>
        </div>

        {/* Operation not allowed error guide */}
        {isNotAllowedError && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Firebaseコンソールでの有効化が必要です</span>
            </div>
            <p className="leading-relaxed">
              Firebase初期設定ではパスワード認証が無効になっています。ユーザーネーム＆パスワードでの登録を有効にするには、以下のリンクから「メール/パスワード」を有効にしてください：
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-amber-800 font-medium">
              <li>下のボタンからFirebaseコンソールの設定ページを開く</li>
              <li>「メール/パスワード」をクリック</li>
              <li>「有効にする」のスイッチをオンにして「保存」をクリック</li>
            </ol>
            <div className="pt-1">
              <a
                href={authSettingsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition shadow-xs"
              >
                <span>Firebaseコンソール設定を開く</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-amber-700 pt-1 border-t border-amber-200">
              💡 設定不要ですぐに利用したい場合は、下の「Googleでログイン」をご利用いただけます。
            </p>
          </div>
        )}

        {error && !isNotAllowedError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ユーザーネーム <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例: taro, tanaka, yuki"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                表示名 (任意)
              </label>
              <div className="relative">
                <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="例: 山田 太郎 (未入力時はユーザーネーム)"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              パスワード <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••• (6文字以上)"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                パスワード確認 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="もう一度パスワードを入力"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? '処理中...' : isSignUp ? 'ユーザーネームでアカウント作成' : 'ユーザーネームでログイン'}
          </button>
        </form>

        {/* Google Login Alternative */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="relative flex items-center justify-center text-xs text-slate-400 mb-3">
            <span className="w-full border-t border-slate-100" />
            <span className="bg-white px-3 shrink-0 text-[11px]">または (ワンクリックでログイン)</span>
            <span className="w-full border-t border-slate-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 text-xs shadow-2xs transition hover:border-slate-300 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Googleで今すぐログイン（コンソール設定不要）
          </button>
        </div>

        <div className="text-center pt-3 border-t border-slate-100 mt-4">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setIsNotAllowedError(false);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            {isSignUp
              ? 'すでにアカウントをお持ちの方はこちら (ログイン)'
              : 'アカウントをお持ちでない方はこちら (サインアップ)'}
          </button>
        </div>
      </div>
    </div>
  );
};
