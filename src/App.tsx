import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, cleanFirestoreData, OperationType } from './firebase';
import { Calendar as CalendarType, ScheduleEvent, PaidLeaveBalance } from './types';
import { usernameToEmail, getDisplayUsername } from './utils/authHelper';
import { Navbar } from './components/Navbar';
import { CalendarList } from './components/CalendarList';
import { CalendarView } from './components/CalendarView';
import { AuthModal } from './components/AuthModal';
import { CreateCalendarModal } from './components/CreateCalendarModal';
import { ShareCalendarModal } from './components/ShareCalendarModal';
import { EventModal } from './components/EventModal';
import { Calendar as CalendarIcon, Sparkles, LogIn, Palmtree, User as UserIcon } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Calendars state
  const [calendars, setCalendars] = useState<CalendarType[]>([]);
  const [currentCalendarId, setCurrentCalendarId] = useState<string | null>(null);

  // Events & Balances for current calendar
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [balances, setBalances] = useState<Record<string, PaidLeaveBalance>>({});

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [initialEventDate, setInitialEventDate] = useState<string | undefined>(undefined);

  // Perspective mode for admin (previewing as member)
  const [isMemberPerspective, setIsMemberPerspective] = useState(false);

  // Current display username
  const currentUsername = currentUser
    ? getDisplayUsername(currentUser.email, currentUser.displayName)
    : '';

  // 1. Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setCalendars([]);
        setCurrentCalendarId(null);
        setEvents([]);
        setBalances({});
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen for calendars belonging to or shared with current user
  useEffect(() => {
    if (!currentUser) return;

    const calendarsRef = collection(db, 'calendars');
    const unsubscribe = onSnapshot(
      calendarsRef,
      (snapshot) => {
        const userEmail = currentUser.email?.toLowerCase();
        const uname = getDisplayUsername(currentUser.email, currentUser.displayName).toLowerCase();
        const calList: CalendarType[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isOwner = data.ownerId === currentUser.uid;
          const isMemberId = Array.isArray(data.memberIds) && data.memberIds.includes(currentUser.uid);
          const isMemberEmail =
            userEmail &&
            Array.isArray(data.memberEmails) &&
            data.memberEmails.map((e: string) => e.toLowerCase()).includes(userEmail);
          const isMemberUsername =
            Array.isArray(data.memberUsernames) &&
            data.memberUsernames.map((u: string) => u.toLowerCase()).includes(uname);

          if (isOwner || isMemberId || isMemberEmail || isMemberUsername) {
            calList.push({
              id: docSnap.id,
              name: data.name || '無題のカレンダー',
              description: data.description || '',
              color: data.color || '#4f46e5',
              ownerId: data.ownerId,
              ownerUsername: data.ownerUsername || data.ownerName || data.ownerEmail?.split('@')[0],
              ownerEmail: data.ownerEmail,
              ownerName: data.ownerName,
              memberIds: data.memberIds || [],
              memberUsernames: data.memberUsernames || [],
              memberEmails: data.memberEmails || [],
              createdAt: data.createdAt || '',
              updatedAt: data.updatedAt || '',
            });
          }
        });

        calList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCalendars(calList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'calendars');
      }
    );

    return () => unsubscribe();
  }, [currentUser, currentCalendarId]);

  // Current calendar object
  const currentCalendar = calendars.find((c) => c.id === currentCalendarId) || null;

  // 3. Listen for events & balances in active calendar
  useEffect(() => {
    if (!currentCalendarId || !currentUser) {
      setEvents([]);
      setBalances({});
      return;
    }

    const eventsPath = `calendars/${currentCalendarId}/events`;
    const eventsRef = collection(db, 'calendars', currentCalendarId, 'events');
    const unsubEvents = onSnapshot(
      eventsRef,
      (snapshot) => {
        const evList: ScheduleEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          evList.push({
            id: docSnap.id,
            calendarId: currentCalendarId,
            title: data.title || '',
            description: data.description || '',
            startDate: data.startDate || '',
            endDate: data.endDate || data.startDate || '',
            startTime: data.startTime,
            endTime: data.endTime,
            isAllDay: data.isAllDay ?? true,
            isPaidLeave: data.isPaidLeave ?? false,
            paidLeaveDays: data.paidLeaveDays ?? 1,
            creatorId: data.creatorId || '',
            creatorName: data.creatorName || '',
            creatorEmail: data.creatorEmail || '',
            targetUserId: data.targetUserId || data.creatorId || '',
            targetUserName: data.targetUserName || data.creatorName || '',
            targetUserEmail: data.targetUserEmail || data.creatorEmail || '',
            color: data.color,
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          });
        });
        setEvents(evList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, eventsPath);
      }
    );

    const balancesPath = `calendars/${currentCalendarId}/paidLeaveBalances`;
    const balancesRef = collection(db, 'calendars', currentCalendarId, 'paidLeaveBalances');
    const unsubBalances = onSnapshot(
      balancesRef,
      (snapshot) => {
        const bMap: Record<string, PaidLeaveBalance> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          bMap[docSnap.id] = {
            userId: docSnap.id,
            userEmail: data.userEmail || '',
            userName: data.userName,
            totalGranted: data.totalGranted ?? 20,
            used: data.used ?? 0,
            notes: data.notes,
            updatedAt: data.updatedAt || '',
          };
        });
        setBalances(bMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, balancesPath);
      }
    );

    return () => {
      unsubEvents();
      unsubBalances();
    };
  }, [currentCalendarId, currentUser]);

  // Actions: Create Calendar
  const handleCreateCalendar = async (data: {
    name: string;
    description: string;
    color: string;
    memberUsernames: string[];
  }) => {
    if (!currentUser) return;

    const newCalId = `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const calPath = `calendars/${newCalId}`;

    try {
      const memberEmails = data.memberUsernames.map(usernameToEmail);

      const calData = cleanFirestoreData({
        id: newCalId,
        name: data.name,
        description: data.description || '',
        color: data.color,
        ownerId: currentUser.uid,
        ownerUsername: currentUsername,
        ownerEmail: currentUser.email || '',
        ownerName: currentUsername,
        memberIds: [currentUser.uid],
        memberUsernames: data.memberUsernames,
        memberEmails,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'calendars', newCalId), calData);

      // Initialize creator's paid leave balance (default 20 days)
      await setDoc(
        doc(db, 'calendars', newCalId, 'paidLeaveBalances', currentUser.uid),
        {
          userId: currentUser.uid,
          userEmail: currentUser.email || '',
          userName: currentUsername,
          totalGranted: 20,
          used: 0,
          updatedAt: new Date().toISOString(),
        }
      );

      setCurrentCalendarId(newCalId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, calPath);
    }
  };

  // Actions: Delete Calendar
  const handleDeleteCalendar = async (calId: string) => {
    const calPath = `calendars/${calId}`;
    try {
      await deleteDoc(doc(db, 'calendars', calId));
      if (currentCalendarId === calId) {
        setCurrentCalendarId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, calPath);
    }
  };

  // Actions: Add Member Username
  const handleAddMemberUsername = async (uname: string) => {
    if (!currentCalendar || !currentUser) return;
    const calPath = `calendars/${currentCalendar.id}`;

    try {
      const currentUList = currentCalendar.memberUsernames || [];
      const updatedUList = Array.from(new Set([...currentUList, uname.trim()]));

      const currentEList = currentCalendar.memberEmails || [];
      const newEmail = usernameToEmail(uname.trim());
      const updatedEList = Array.from(new Set([...currentEList, newEmail]));

      await updateDoc(doc(db, 'calendars', currentCalendar.id), {
        memberUsernames: updatedUList,
        memberEmails: updatedEList,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, calPath);
    }
  };

  // Actions: Remove Member Username
  const handleRemoveMemberUsername = async (uname: string) => {
    if (!currentCalendar || !currentUser) return;
    const calPath = `calendars/${currentCalendar.id}`;

    try {
      const currentUList = currentCalendar.memberUsernames || [];
      const updatedUList = currentUList.filter((u) => u.toLowerCase() !== uname.toLowerCase());

      const emailToRemove = usernameToEmail(uname.trim());
      const currentEList = currentCalendar.memberEmails || [];
      const updatedEList = currentEList.filter((e) => e.toLowerCase() !== emailToRemove.toLowerCase());

      await updateDoc(doc(db, 'calendars', currentCalendar.id), {
        memberUsernames: updatedUList,
        memberEmails: updatedEList,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, calPath);
    }
  };

  // Actions: Save Event (Create or Update)
  const handleSaveEvent = async (
    eventData: Omit<ScheduleEvent, 'id' | 'calendarId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!currentCalendarId || !currentUser) return;

    if (selectedEvent) {
      const eventPath = `calendars/${currentCalendarId}/events/${selectedEvent.id}`;
      try {
        const payload = cleanFirestoreData({
          ...eventData,
          updatedAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, 'calendars', currentCalendarId, 'events', selectedEvent.id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, eventPath);
      }
    } else {
      const eventId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const eventPath = `calendars/${currentCalendarId}/events/${eventId}`;
      try {
        const payload = cleanFirestoreData({
          id: eventId,
          calendarId: currentCalendarId,
          ...eventData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'calendars', currentCalendarId, 'events', eventId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, eventPath);
      }
    }
  };

  // Actions: Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!currentCalendarId) return;
    const eventPath = `calendars/${currentCalendarId}/events/${eventId}`;
    try {
      await deleteDoc(doc(db, 'calendars', currentCalendarId, 'events', eventId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, eventPath);
    }
  };

  // Actions: Update Paid Leave Grant
  const handleUpdateGrant = async (
    targetUserId: string,
    granted: number,
    userEmail: string,
    userName: string
  ) => {
    if (!currentCalendarId) return;
    const balancePath = `calendars/${currentCalendarId}/paidLeaveBalances/${targetUserId}`;

    try {
      const balancePayload = cleanFirestoreData({
        userId: targetUserId,
        userEmail: userEmail || '',
        userName: userName || '',
        totalGranted: granted,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(
        doc(db, 'calendars', currentCalendarId, 'paidLeaveBalances', targetUserId),
        balancePayload,
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, balancePath);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navbar
        user={currentUser}
        currentCalendar={currentCalendar}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCreateCalendar={() => {
          if (!currentUser) setIsAuthOpen(true);
          else setIsCreateCalendarOpen(true);
        }}
        onBackToCalendarList={() => {
          setCurrentCalendarId(null);
          setIsMemberPerspective(false);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {authLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : !currentUser ? (
          /* Landing Screen when signed out */
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
              <CalendarIcon className="w-8 h-8" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              チームスケジュール & 有給休暇管理
            </h1>

            <p className="text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
              ユーザーネームとパスワードで簡単ログイン。Googleスライドのように1つのアカウントで複数のカレンダーを作成・共有でき、有給休暇の残数や取得予定もリアルタイムに管理できます。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
              <button
                onClick={() => setIsAuthOpen(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>ユーザーネームでログイン / 新規登録</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <UserIcon className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 mb-2">ユーザーネーム認証</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  メールアドレス不要！お好きなユーザーネームとパスワードだけで登録＆ログイン可能です。
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <Palmtree className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 mb-2">有給休暇 & 残数追跡</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  誰が何月何日に有給を取るかを一目で把握。残り有給日数や取得状況も自動集計。
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold text-slate-800 mb-2">管理者権限 & 共有</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  作成者が管理者となり全員の予定を編集可能。メンバーは自分の予定のみ安全に編集できます。
                </p>
              </div>
            </div>
          </div>
        ) : currentCalendar ? (
          /* Calendar View Screen */
          <CalendarView
            calendar={currentCalendar}
            currentUser={currentUser}
            events={events}
            balances={balances}
            isMemberPerspective={isMemberPerspective}
            onTogglePerspective={() => setIsMemberPerspective(!isMemberPerspective)}
            onOpenNewEvent={(initialDate) => {
              setSelectedEvent(null);
              setInitialEventDate(initialDate);
              setIsEventModalOpen(true);
            }}
            onOpenNewLeave={(targetUserId, targetUserName, targetUserEmail) => {
              setSelectedEvent(null);
              setInitialEventDate(new Date().toISOString().split('T')[0]);
              setIsEventModalOpen(true);
            }}
            onOpenShare={() => setIsShareOpen(true)}
            onSelectEvent={(event) => {
              setSelectedEvent(event);
              setIsEventModalOpen(true);
            }}
            onDeleteEvent={handleDeleteEvent}
            onUpdateGrant={handleUpdateGrant}
          />
        ) : (
          /* Calendar List Screen (Google Slides style home) */
          <CalendarList
            user={currentUser}
            calendars={calendars}
            onSelectCalendar={(cal) => {
              setCurrentCalendarId(cal.id);
              setIsMemberPerspective(false);
            }}
            onOpenCreateModal={() => setIsCreateCalendarOpen(true)}
            onDeleteCalendar={handleDeleteCalendar}
            onShareCalendar={(cal) => {
              setCurrentCalendarId(cal.id);
              setIsMemberPerspective(false);
              setIsShareOpen(true);
            }}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {currentUser && (
        <>
          <CreateCalendarModal
            isOpen={isCreateCalendarOpen}
            onClose={() => setIsCreateCalendarOpen(false)}
            onSubmit={handleCreateCalendar}
            user={currentUser}
          />

          {currentCalendar && (
            <>
              <ShareCalendarModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                calendar={currentCalendar}
                currentUser={currentUser}
                onAddMemberUsername={handleAddMemberUsername}
                onRemoveMemberUsername={handleRemoveMemberUsername}
              />

              <EventModal
                isOpen={isEventModalOpen}
                onClose={() => {
                  setIsEventModalOpen(false);
                  setSelectedEvent(null);
                  setInitialEventDate(undefined);
                }}
                event={selectedEvent}
                initialDate={initialEventDate}
                calendar={currentCalendar}
                currentUser={currentUser}
                isEffectiveAdmin={
                  Boolean(
                    (currentCalendar.ownerId === currentUser.uid ||
                      (currentCalendar.ownerEmail &&
                        currentUser.email &&
                        currentCalendar.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                      (currentCalendar.ownerUsername &&
                        currentUsername &&
                        currentCalendar.ownerUsername.toLowerCase() === currentUsername.toLowerCase())) &&
                    !isMemberPerspective
                  )
                }
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
export default App;
