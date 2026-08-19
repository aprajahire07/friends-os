import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { CreateActionSheet } from './components/layout/CreateActionSheet';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { GroupChat } from './components/chat/GroupChat';
import { FriendsList } from './components/friends/FriendsList';
import { ExpenseDashboard } from './components/expenses/ExpenseDashboard';
import { PlansList } from './components/plans/PlansList';
import { MemoryGallery } from './components/memories/MemoryGallery';
import { SnapsFeed } from './components/snaps/SnapsFeed';
import { BorrowedTracker } from './components/borrowed/BorrowedTracker';
import { CollegeClassesTab } from './components/college/CollegeClassesTab';
import { NotesList } from './components/notes/NotesList';
import { UploadNoteModal } from './components/notes/UploadNoteModal';
import { MeTab } from './components/profile/MeTab';
import { PaymentQRModal } from './components/expenses/PaymentQRModal';
import { FriendProfileModal } from './components/friends/FriendProfileModal';
import { SendSnapModal } from './components/snaps/SendSnapModal';
import { AddMoneyConversationalModal } from './components/expenses/AddMoneyConversationalModal';
import { CreatePlanModal } from './components/plans/CreatePlanModal';
import { UploadMemoryModal } from './components/memories/UploadMemoryModal';
import { AddBorrowedItemModal } from './components/borrowed/AddBorrowedItemModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { AuthModal } from './components/auth/AuthModal';
import { BannedAccountView } from './components/auth/BannedAccountView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PWAStatusBar } from './components/pwa/PWAStatusBar';
import { PWAInstallModal } from './components/pwa/PWAInstallModal';
import { Profile } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { appStore, useAppStore } from './lib/store';
import { subscribeToAllRealtimeTables } from './services/realtime';
import { fetchProfileById } from './services/profiles';
import { isUserAdmin } from './services/appSettings';
import { withTimeout } from './lib/asyncUtils';
import { Loader2 } from 'lucide-react';

export function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('home');
  // If local user is already cached, avoid blocking UI on initial reload
  const [authChecking, setAuthChecking] = useState<boolean>(!appStore.currentUser && isSupabaseConfigured);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot' | 'reset_password'>('login');
  const { showToast } = useToast();
  
  // Keep toast callback stable for subscriptions
  const toastRef = React.useRef(showToast);
  useEffect(() => {
    toastRef.current = showToast;
  }, [showToast]);

  // Reactive store state
  useAppStore();
  const currentUser = appStore.currentUser;

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        if (isSupabaseConfigured && supabase) {
          const sessionRes = await withTimeout(supabase.auth.getSession(), 4000, { data: { session: null }, error: null });
          const session = (sessionRes as any)?.data?.session;

          if (session?.user && mounted) {
            const profile = await withTimeout(fetchProfileById(session.user.id), 4000, null);
            if (profile && mounted) {
              appStore.setCurrentUser(profile);
              // Trigger background sync without blocking interactive rendering
              appStore.syncFromSupabase();
            }
          } else if (!appStore.currentUser && mounted) {
            // No session and no cached user
            setAuthChecking(false);
          }
        }
      } catch (e) {
        console.warn('Session init note:', e);
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }

    initSession();

    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setAuthModalMode('reset_password');
        } else if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfileById(session.user.id);
          if (profile && mounted) {
            appStore.setCurrentUser(profile);
            appStore.syncFromSupabase();
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            appStore.logout();
          }
        }
      });

      const unsubscribeRealtime = subscribeToAllRealtimeTables((newNotif) => {
        if (newNotif && toastRef.current) {
          toastRef.current(newNotif.title || 'New Notification', newNotif.message || '', 'info');
        }
      });

      return () => {
        mounted = false;
        authListener?.subscription?.unsubscribe?.();
        unsubscribeRealtime();
      };
    } else {
      setAuthChecking(false);
    }
  }, []);

  // Shared Action Sheet & Modals State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [qrFriend, setQrFriend] = useState<Profile | null>(null);
  const [snapFriend, setSnapFriend] = useState<Profile | null>(null);
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
  const [showAddBorrowedModal, setShowAddBorrowedModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showPWAInstallModal, setShowPWAInstallModal] = useState(false);

  // Preselected friend for 1-on-1 actions
  const [preselectedFriend, setPreselectedFriend] = useState<Profile | null>(null);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
  const [activeChatFriendId, setActiveChatFriendId] = useState<string | null>(null);

  const handleOpenFriendProfile = (friend: Profile) => {
    setFriendProfile(friend);
  };

  const handleOpenChatWithFriend = (friend: Profile) => {
    setActiveChatFriendId(friend.id);
    setActiveTab('chat');
  };

  const handleOpenPaymentQR = (friend: Profile) => {
    setQrFriend(friend);
  };

  const handleSendSnapTo = (friend: Profile) => {
    setSnapFriend(friend);
    setShowSnapModal(true);
  };

  const handleOpenAddMoneyForFriend = (friend: Profile) => {
    setPreselectedFriend(friend);
    setShowAddMoneyModal(true);
  };

  const handleOpenBorrowForFriend = (friend: Profile) => {
    setPreselectedFriend(friend);
    setShowAddBorrowedModal(true);
  };

  // 1. Loading screen while verifying Supabase session
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Connecting to FRIEND OS...</p>
      </div>
    );
  }

  // 2. Route Protection: Unauthenticated users are redirected to real AuthModal
  if (!currentUser) {
    return (
      <AuthModal
        initialMode={authModalMode}
        onSuccess={(profile) => {
          appStore.setCurrentUser(profile);
          appStore.syncFromSupabase();
        }}
      />
    );
  }

  const isAdminUser = isUserAdmin(currentUser);

  // 3. Security Check: Banned user account block
  if (currentUser.is_banned && !isAdminUser) {
    return <BannedAccountView userEmail={currentUser.email} userName={currentUser.full_name} />;
  }

  // 4. Route Protection for Admin Tab
  if (activeTab === 'admin' && !isAdminUser) {
    setActiveTab('home');
  }

  // 5. Authenticated Application
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* PWA Offline / Update & Install Notification Bar */}
      <PWAStatusBar onOpenInstallModal={() => setShowPWAInstallModal(true)} />

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setShowOnboardingModal(true)}
        onOpenInstallPWA={() => setShowPWAInstallModal(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto min-h-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCreateSheet={() => setShowCreateSheet(true)}
          onOpenInstallPWA={() => setShowPWAInstallModal(true)}
        />

        <main className={`flex-1 overflow-x-hidden ${
          activeTab === 'chat' 
            ? 'p-1 sm:p-2 md:p-4 flex flex-col h-[calc(100dvh-3.75rem)] md:h-[calc(100vh-4rem)] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-4 min-h-0' 
            : 'p-4 md:p-6 pb-24 md:pb-6'
        }`}>
          <ErrorBoundary key={activeTab} fallbackTitle="View Error">
            {activeTab === 'home' && (
              <MainDashboard
                onSelectTab={setActiveTab}
                onOpenSendSnap={() => {
                  setSnapFriend(null);
                  setShowSnapModal(true);
                }}
                onOpenAddMoney={() => setShowAddMoneyModal(true)}
                onOpenCreatePlan={() => setShowCreatePlanModal(true)}
              />
            )}

            {activeTab === 'friends' && (
              <FriendsList
                onOpenPaymentQR={handleOpenPaymentQR}
                onSendSnapTo={handleSendSnapTo}
                onSelectTab={setActiveTab}
                onOpenChatWithFriend={handleOpenChatWithFriend}
                onOpenAddMoneyForFriend={handleOpenAddMoneyForFriend}
                onOpenBorrowForFriend={handleOpenBorrowForFriend}
              />
            )}

            {activeTab === 'chat' && (
              <GroupChat 
                initialFriendId={activeChatFriendId} 
                onOpenProfile={handleOpenFriendProfile} 
              />
            )}

            {activeTab === 'expenses' && (
              <ExpenseDashboard
                onOpenPaymentQR={handleOpenPaymentQR}
                preselectedFriendForMoney={preselectedFriend}
              />
            )}

            {activeTab === 'plans' && <PlansList />}

            {activeTab === 'snaps' && <SnapsFeed />}

            {activeTab === 'memories' && <MemoryGallery />}

            {activeTab === 'borrowed' && <BorrowedTracker />}

            {activeTab === 'college' && <CollegeClassesTab />}

            {activeTab === 'notes' && <NotesList />}

            {activeTab === 'me' && (
              <MeTab
                onSelectTab={setActiveTab}
                onOpenPaymentQR={handleOpenPaymentQR}
                onOpenOnboarding={() => setShowOnboardingModal(true)}
                onOpenInstallPWA={() => setShowPWAInstallModal(true)}
              />
            )}

            {activeTab === 'admin' && isAdminUser && (
              <AdminDashboard onBackToHome={() => setActiveTab('home')} />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Bottom Navigation Action Sheet */}
      <CreateActionSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onOpenSendSnap={() => {
          setSnapFriend(null);
          setShowSnapModal(true);
        }}
        onOpenAddMoney={() => setShowAddMoneyModal(true)}
        onOpenCreatePlan={() => setShowCreatePlanModal(true)}
        onOpenAddMemory={() => setShowAddMemoryModal(true)}
        onOpenAddBorrowed={() => setShowAddBorrowedModal(true)}
        onOpenAddNote={() => setShowAddNoteModal(true)}
      />

      {/* Global Modals */}
      <FriendProfileModal
        friend={friendProfile}
        onClose={() => setFriendProfile(null)}
        onOpenPaymentQR={handleOpenPaymentQR}
        onSendSnapTo={handleSendSnapTo}
        onSelectTab={setActiveTab}
        onOpenChatWithFriend={handleOpenChatWithFriend}
        onOpenAddMoneyForFriend={handleOpenAddMoneyForFriend}
        onOpenBorrowForFriend={handleOpenBorrowForFriend}
      />

      <PaymentQRModal friend={qrFriend} onClose={() => setQrFriend(null)} />

      <SendSnapModal
        recipient={snapFriend}
        isOpen={showSnapModal}
        onClose={() => {
          setShowSnapModal(false);
          setSnapFriend(null);
        }}
      />

      <AddMoneyConversationalModal
        isOpen={showAddMoneyModal}
        onClose={() => {
          setShowAddMoneyModal(false);
          setPreselectedFriend(null);
        }}
        preselectedFriend={preselectedFriend}
      />

      <CreatePlanModal
        isOpen={showCreatePlanModal}
        onClose={() => setShowCreatePlanModal(false)}
      />

      <UploadMemoryModal
        isOpen={showAddMemoryModal}
        onClose={() => setShowAddMemoryModal(false)}
      />

      <UploadNoteModal
        isOpen={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
      />

      <AddBorrowedItemModal
        isOpen={showAddBorrowedModal}
        onClose={() => {
          setShowAddBorrowedModal(false);
          setPreselectedFriend(null);
        }}
      />

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      <PWAInstallModal
        isOpen={showPWAInstallModal}
        onClose={() => setShowPWAInstallModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
