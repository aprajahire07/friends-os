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
import { ToastProvider, useToast } from './components/ui/Toast';
import { Profile } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { appStore, useAppStore } from './lib/store';
import { subscribeToAllRealtimeTables } from './services/realtime';
import { fetchProfileById } from './services/profiles';
import { Loader2 } from 'lucide-react';

export function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot' | 'reset_password'>('login');
  const { showToast } = useToast();
  
  // Reactive store state
  useAppStore();
  const currentUser = appStore.currentUser;

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            const profile = await fetchProfileById(session.user.id);
            if (profile && mounted) {
              appStore.setCurrentUser(profile);
              await appStore.syncFromSupabase();
            }
          }
        }
      } catch (e) {
        console.warn('Session init error:', e);
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
        if (newNotif) {
          showToast(newNotif.title || 'New Notification', newNotif.message || '', 'info');
        }
      });

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
        unsubscribeRealtime();
      };
    } else {
      setAuthChecking(false);
    }
  }, [showToast]);

  // Shared Action Sheet & Modals State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [qrFriend, setQrFriend] = useState<Profile | null>(null);
  const [snapFriend, setSnapFriend] = useState<Profile | null>(null);
  const [showSnapModal, setShowSnapModal] = useState(false);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
  const [showAddBorrowedModal, setShowAddBorrowedModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Preselected friend for 1-on-1 actions
  const [preselectedFriend, setPreselectedFriend] = useState<Profile | null>(null);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);

  const handleOpenFriendProfile = (friend: Profile) => {
    setFriendProfile(friend);
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

  // 3. Authenticated Application
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setShowOnboardingModal(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCreateSheet={() => setShowCreateSheet(true)}
        />

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
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
              onOpenAddMoneyForFriend={handleOpenAddMoneyForFriend}
              onOpenBorrowForFriend={handleOpenBorrowForFriend}
            />
          )}

          {activeTab === 'chat' && <GroupChat onOpenProfile={handleOpenFriendProfile} />}

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

          {activeTab === 'me' && (
            <MeTab
              onSelectTab={setActiveTab}
              onOpenPaymentQR={handleOpenPaymentQR}
              onOpenOnboarding={() => setShowOnboardingModal(true)}
            />
          )}
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
      />

      {/* Global Modals */}
      <FriendProfileModal
        friend={friendProfile}
        onClose={() => setFriendProfile(null)}
        onOpenPaymentQR={handleOpenPaymentQR}
        onSendSnapTo={handleSendSnapTo}
        onSelectTab={setActiveTab}
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
