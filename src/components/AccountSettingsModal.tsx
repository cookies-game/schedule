import React, { useState, useEffect } from 'react';
import {
  User,
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { usernameToEmail, getDisplayUsername, extractUsernameFromEmail } from '../utils/authHelper';
import { UserProfile } from '../types';
import {
  X,
  User as UserIcon,
  Lock,
  Trash2,
  Check,
  AlertCircle,
  Camera,
  KeyRound,
  ShieldAlert,
  Sparkles,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProfileUpdated?: () => void;
  onAccountDeleted?: () => void;
}

// 8 stylish SVG / gradient preset avatars
const PRESET_AVATARS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600', emoji: '🧑‍💻' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600', emoji: '🌿' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', emoji: '🌸' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', emoji: '🦊' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-600', emoji: '🚀' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500', emoji: '🐬' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-800', emoji: '⚡' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-600', emoji: '🍀' },
];

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  onAccountDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'danger'>('profile');

  // Profile Form State
  const initialUsername =
    extractUsernameFromEmail(currentUser.email) ||
    getDisplayUsername(currentUser.email, currentUser.displayName);
  const [displayName, setDisplayName] = useState(currentUser.displayName || initialUsername);
  const [username, setUsername] = useState(initialUsername);
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [customPhotoInput, setCustomPhotoInput] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // Delete Account State
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Feedback State
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load existing profile from Firestore if any
  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setDeletePassword('');
    setDeleteConfirmText('');

    const fetchProfile = async () => {
      try {
        const uSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (uSnap.exists()) {
          const data = uSnap.data() as UserProfile;
          if (data.displayName) setDisplayName(data.displayName);
          if (data.username) setUsername(data.username);
          if (data.photoURL) setPhotoURL(data.photoURL);
        } else {
          setDisplayName(currentUser.displayName || initialUsername);
          setUsername(initialUsername);
          setPhotoURL(currentUser.photoURL || '');
        }
      } catch (e) {
        console.error('Error fetching user profile:', e);
      }
    };
    fetchProfile();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Handle Preset Avatar Selection
  const handleSelectPresetAvatar = (avatar: typeof PRESET_AVATARS[0]) => {
    // Generate inline SVG data URI with chosen gradient and emoji
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${avatar.id === 'indigo' ? '#4f46e5' : avatar.id === 'emerald' ? '#059669' : avatar.id === 'rose' ? '#f43f5e' : avatar.id === 'amber' ? '#f59e0b' : avatar.id === 'purple' ? '#9333ea' : avatar.id === 'sky' ? '#0284c7' : avatar.id === 'slate' ? '#1e293b' : '#0d9488'}"/>
          <stop offset="100%" stop-color="${avatar.id === 'indigo' ? '#3730a3' : avatar.id === 'emerald' ? '#047857' : avatar.id === 'rose' ? '#e11d48' : avatar.id === 'amber' ? '#d97706' : avatar.id === 'purple' ? '#7e22ce' : avatar.id === 'sky' ? '#0369a1' : avatar.id === 'slate' ? '#0f172a' : '#0f766e'}"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="64" fill="url(#g)"/>
      <text x="50%" y="54%" font-size="64" text-anchor="middle" dominant-baseline="central">${avatar.emoji}</text>
    </svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setPhotoURL(dataUri);
  };

  // Handle Local File Upload with thumbnail compression via canvas
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('画像サイズは8MB以下にしてください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          // Resize to maximum 128x128 thumbnail
          const canvas = document.createElement('canvas');
          const size = 128;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setPhotoURL(compressed);
          } else {
            setPhotoURL(reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // 1. Update Profile (DisplayName, Username, PhotoURL)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedDisplayName = displayName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername || trimmedUsername.length < 2) {
      setErrorMsg('ユーザーネームは2文字以上で入力してください。');
      setLoading(false);
      return;
    }

    try {
      // 1. Update Firebase Auth Profile
      // Firebase Auth throws 'auth/invalid-profile-attribute (Photo URL too long)' for data URIs or long strings.
      // Only short http(s) URLs under 1000 chars are sent to Auth; data URIs are stored safely in Firestore.
      const isShortHttpUrl =
        photoURL &&
        !photoURL.startsWith('data:') &&
        (photoURL.startsWith('http://') || photoURL.startsWith('https://')) &&
        photoURL.length < 1000;

      try {
        await updateProfile(currentUser, {
          displayName: trimmedDisplayName || trimmedUsername,
          photoURL: isShortHttpUrl ? photoURL : null,
        });
      } catch (authErr) {
        console.warn('Firebase Auth updateProfile photoURL skipped, fallback to displayName:', authErr);
        await updateProfile(currentUser, {
          displayName: trimmedDisplayName || trimmedUsername,
        });
      }

      // 2. Update Firestore User Document (stores full avatar data URL and profile)
      const newEmail = usernameToEmail(trimmedUsername);
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          uid: currentUser.uid,
          username: trimmedUsername,
          email: newEmail,
          displayName: trimmedDisplayName || trimmedUsername,
          photoURL: photoURL || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setSuccessMsg('プロフィール情報を正常に更新しました！');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'プロフィールの更新に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // 2. Update Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('新しいパスワードは6文字以上で設定してください。');
      setLoading(false);
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMsg('新しいパスワードが一致しません。');
      setLoading(false);
      return;
    }

    try {
      // Re-authenticate user with current password
      if (!currentUser.email) {
        throw new Error('ログイン中のユーザーのメールアドレスが見つかりません。');
      }

      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setSuccessMsg('パスワードを変更しました！次回ログイン時は新しいパスワードをご利用ください。');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('現在のパスワードが正しくありません。');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('パスワードはより強固なもの（6文字以上）にしてください。');
      } else {
        setErrorMsg(err.message || 'パスワードの変更に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (deleteConfirmText !== '削除') {
      setErrorMsg('確認のため「削除」と正確に入力してください。');
      setLoading(false);
      return;
    }

    try {
      if (!currentUser.email) {
        throw new Error('ユーザー情報の確認ができませんでした。');
      }

      // Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Clean up user document in Firestore
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid));
      } catch (docErr) {
        console.warn('Could not delete user doc:', docErr);
      }

      // Delete Firebase Auth User
      await deleteUser(currentUser);

      onClose();
      if (onAccountDeleted) onAccountDeleted();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('パスワードが正しくありません。');
      } else if (err.code === 'auth/requires-recent-login') {
        setErrorMsg('セキュリティのため、再ログインしてからもう一度お試しください。');
      } else {
        setErrorMsg(err.message || 'アカウントの削除に失敗しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl transition-all border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-200">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Avatar"
                  className="w-10 h-10 rounded-2xl object-cover"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">アカウント設定</h2>
              <p className="text-xs text-slate-500">
                @{username} • {displayName || '名前未設定'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-slate-100 shrink-0 bg-white">
          <button
            onClick={() => {
              setActiveTab('profile');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>プロフィール情報</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('password');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'password'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>パスワード変更</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('danger');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'danger'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-rose-600'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>アカウント削除</span>
          </button>
        </div>

        {/* Alerts */}
        <div className="px-6 pt-3 shrink-0">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Tab 1: Profile Settings */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Avatar Section */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                プロフィール画像
              </label>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {photoURL ? (
                    <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-semibold text-slate-800">アイコンの変更方法</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>写真・画像をアップロード</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {photoURL && (
                      <button
                        type="button"
                        onClick={() => setPhotoURL('')}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer font-medium"
                      >
                        画像をリセット
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preset Avatars */}
              <div className="space-y-1.5 mb-3">
                <div className="text-[11px] font-semibold text-slate-500">ワンクリックプリセット</div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(av)}
                      className={`w-9 h-9 rounded-xl ${av.bg} text-white flex items-center justify-center text-base hover:scale-110 transition shadow-2xs cursor-pointer shrink-0`}
                      title={av.label}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image URL Input */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  <span>または画像URLを直接指定</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customPhotoInput}
                    onChange={(e) => setCustomPhotoInput(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPhotoInput.trim()) {
                        setPhotoURL(customPhotoInput.trim());
                        setCustomPhotoInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    適用
                  </button>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                表示名 (名前)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例: 田中 太郎"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                カレンダーや予定表で他のメンバーに表示されるお名前です。
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ユーザーネーム <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                ログインやカレンダー共有時に使用する一意の識別名です。
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? '保存中...' : 'プロフィールを保存'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Password Settings */}
        {activeTab === 'password' && (
          <form onSubmit={handleSavePassword} className="p-6 space-y-5 overflow-y-auto flex-1">
            <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 leading-relaxed">
              安全のため、パスワード変更には現在のパスワードの入力が必要です。
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                現在のパスワード <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="現在のパスワード"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                新しいパスワード <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6文字以上の新しいパスワード"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* New Password Confirm */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                新しいパスワード (確認) <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="新しいパスワードを再入力"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? '変更中...' : 'パスワードを変更する'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Danger Zone (Delete Account) */}
        {activeTab === 'danger' && (
          <form onSubmit={handleDeleteAccount} className="p-6 space-y-5 overflow-y-auto flex-1">
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>アカウントの完全削除</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                アカウントを削除すると、プロフィール情報やログインデータは完全に消去され、元に戻すことはできません。
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                確認のため「削除」と入力してください <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="削除"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-bold text-rose-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                パスワードを入力して認証 <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="現在のパスワード"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || deleteConfirmText !== '削除' || !deletePassword}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-200 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? '削除実行中...' : 'アカウントを完全に削除する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
