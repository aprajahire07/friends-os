import { useState, useEffect } from 'react';
import { 
  Profile, 
  GroupMember, 
  ChatMessage, 
  GroupExpense, 
  PersonalLoan, 
  GroupPlan, 
  PlanPoll,
  Memory, 
  BorrowedItem, 
  ImportantDate, 
  Timetable, 
  DateAttendanceRecord,
  GroupCancellationReport,
  Assignment,
  SnapMessage, 
  AppNotification,
  ChatCategory,
  FriendGroup
} from '../types';
import { resolveCollegeId, GHRCE_COLLEGE_ID, SKILLTECH_COLLEGE_ID } from './timetables';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchProfilesFromSupabase, updateProfileInSupabase } from '../services/profiles';
import { fetchMessagesFromSupabase, sendMessageToSupabase } from '../services/chat';
import { fetchExpensesFromSupabase, addExpenseToSupabase, fetchLoansFromSupabase, addLoanToSupabase, settleLoanInSupabase, settleExpenseShareInSupabase } from '../services/expenses';
import { fetchPlansFromSupabase, addPlanToSupabase, updatePlanRsvpInSupabase, votePollOptionInSupabase, addPollToPlanInSupabase } from '../services/plans';
import { fetchMemoriesFromSupabase, addMemoryToSupabase } from '../services/memories';
import { fetchBorrowedItemsFromSupabase, addBorrowedItemToSupabase, markItemReturnedInSupabase } from '../services/borrowed';
import { fetchDateAttendanceFromSupabase, markDateAttendanceInSupabase, fetchClassReportsFromSupabase, reportClassCancellationInSupabase } from '../services/attendance';
import { fetchSnapsFromSupabase, sendSnapToSupabase, openSnapInSupabase, destroySnapInSupabase } from '../services/snaps';
import { fetchNotificationsFromSupabase, addNotificationToSupabase, markNotificationsReadInSupabase } from '../services/notifications';
import { fetchUserGroup } from '../services/groups';
import { 
  fetchMemoryLockSettingsFromSupabase, 
  updateMemoryLockInSupabase, 
  updateMemoryPasscodeInSupabase, 
  computeSha256, 
  isUserAdmin, 
  DEFAULT_PASSCODE_HASH 
} from '../services/appSettings';

// Helper to safely load from local storage
function loadInitialState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(`friend_os_${key}`);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error(`Failed to parse stored ${key}`, e);
    return fallback;
  }
}

// Helper to save state
function saveState<T>(key: string, value: T) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`friend_os_${key}`, JSON.stringify(value));
  }
}

// Reactive Event Bus System for real-time local listeners
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export const appStore = {
  // Current logged in user (null when logged out)
  currentUser: loadInitialState<Profile | null>('currentUser', null) as Profile,
  
  // App State collections
  group: loadInitialState<FriendGroup | null>('group', null),
  profiles: loadInitialState<Profile[]>('profiles', []),
  messages: loadInitialState<ChatMessage[]>('messages', []),
  expenses: loadInitialState<GroupExpense[]>('expenses', []),
  loans: loadInitialState<PersonalLoan[]>('loans', []),
  plans: loadInitialState<GroupPlan[]>('plans', []),
  borrowed: loadInitialState<BorrowedItem[]>('borrowed', []),
  memories: loadInitialState<Memory[]>('memories', []),
  importantDates: loadInitialState<ImportantDate[]>('importantDates', []),
  timetables: loadInitialState<Timetable[]>('timetables', []),
  timetable: [] as any[],
  
  // Date-based Attendance & Cancellation Collections
  dateAttendanceRecords: loadInitialState<DateAttendanceRecord[]>('dateAttendanceRecords', []),
  cancellationReports: loadInitialState<GroupCancellationReport[]>('cancellationReports', []),
  assignments: loadInitialState<Assignment[]>('assignments', []),
  snaps: loadInitialState<SnapMessage[]>('snaps', []),
  streaks: [] as { friend_id: string; streak_count: number }[],
  notifications: loadInitialState<AppNotification[]>('notifications', []),
  
  // Memories Lock & Security (Admin controlled)
  memoriesLocked: loadInitialState<boolean>('memoriesLocked', false),
  memoriesPasscodeHash: loadInitialState<string>('memoriesPasscodeHash', DEFAULT_PASSCODE_HASH),
  sessionUnlockedMemories: false,

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async syncFromSupabase() {
    if (!isSupabaseConfigured || !this.currentUser) return;

    try {
      const collegeId = resolveCollegeId(this.currentUser.college);
      const [
        remoteProfiles,
        remoteMessages,
        remoteExpenses,
        remoteLoans,
        remotePlans,
        remoteMemories,
        remoteBorrowed,
        remoteAttendance,
        remoteReports,
        remoteSnaps,
        remoteNotifications,
        remoteSettings,
        remoteGroupData
      ] = await Promise.all([
        fetchProfilesFromSupabase(),
        fetchMessagesFromSupabase(),
        fetchExpensesFromSupabase(),
        fetchLoansFromSupabase(),
        fetchPlansFromSupabase(),
        fetchMemoriesFromSupabase(),
        fetchBorrowedItemsFromSupabase(),
        fetchDateAttendanceFromSupabase(this.currentUser.id, collegeId),
        fetchClassReportsFromSupabase(collegeId),
        fetchSnapsFromSupabase(this.currentUser.id),
        fetchNotificationsFromSupabase(this.currentUser.id),
        fetchMemoryLockSettingsFromSupabase(),
        fetchUserGroup(this.currentUser.id)
      ]);

      if (remoteGroupData) {
        this.group = remoteGroupData.group;
        saveState('group', this.group);
      }

      if (remoteSettings) {
        this.memoriesLocked = remoteSettings.is_locked;
        this.memoriesPasscodeHash = remoteSettings.passcode_hash || DEFAULT_PASSCODE_HASH;
        saveState('memoriesLocked', this.memoriesLocked);
        saveState('memoriesPasscodeHash', this.memoriesPasscodeHash);
      }

      if (remoteProfiles && remoteProfiles.length > 0) {
        this.profiles = remoteProfiles;
        const currentMatched = remoteProfiles.find(p => p.id === this.currentUser?.id);
        if (currentMatched) {
          this.currentUser = { ...this.currentUser, ...currentMatched };
          saveState('currentUser', this.currentUser);
        }
        saveState('profiles', this.profiles);
      }
      if (remoteMessages) this.messages = remoteMessages;
      if (remoteExpenses) this.expenses = remoteExpenses;
      if (remoteLoans) this.loans = remoteLoans;
      if (remotePlans) this.plans = remotePlans;
      if (remoteMemories) this.memories = remoteMemories;
      if (remoteBorrowed) this.borrowed = remoteBorrowed;
      if (remoteAttendance) this.dateAttendanceRecords = remoteAttendance;
      if (remoteReports) this.cancellationReports = remoteReports;
      if (remoteSnaps) this.snaps = remoteSnaps;
      if (remoteNotifications) this.notifications = remoteNotifications;

      notifyListeners();
    } catch (err) {
      console.warn('Sync from Supabase completed with note:', err);
    }
  },

  async syncProfiles() {
    if (!isSupabaseConfigured) return;
    try {
      const remoteProfiles = await fetchProfilesFromSupabase();
      if (remoteProfiles && remoteProfiles.length > 0) {
        this.profiles = remoteProfiles;
        if (this.currentUser) {
          const currentMatched = remoteProfiles.find(p => p.id === this.currentUser.id);
          if (currentMatched) {
            this.currentUser = { ...this.currentUser, ...currentMatched };
            saveState('currentUser', this.currentUser);
          }
        }
        saveState('profiles', this.profiles);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing profiles:', err);
    }
  },

  async syncMessages() {
    if (!isSupabaseConfigured) return;
    try {
      const remoteMessages = await fetchMessagesFromSupabase();
      if (remoteMessages) {
        this.messages = remoteMessages;
        saveState('messages', this.messages);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing messages:', err);
    }
  },

  async syncExpensesAndLoans() {
    if (!isSupabaseConfigured) return;
    try {
      const [remoteExpenses, remoteLoans] = await Promise.all([
        fetchExpensesFromSupabase(),
        fetchLoansFromSupabase()
      ]);
      if (remoteExpenses) {
        this.expenses = remoteExpenses;
        saveState('expenses', this.expenses);
      }
      if (remoteLoans) {
        this.loans = remoteLoans;
        saveState('loans', this.loans);
      }
      notifyListeners();
    } catch (err) {
      console.warn('Error syncing expenses/loans:', err);
    }
  },

  async syncPlans() {
    if (!isSupabaseConfigured) return;
    try {
      const remotePlans = await fetchPlansFromSupabase();
      if (remotePlans) {
        this.plans = remotePlans;
        saveState('plans', this.plans);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing plans:', err);
    }
  },

  async syncMemories() {
    if (!isSupabaseConfigured) return;
    try {
      const remoteMemories = await fetchMemoriesFromSupabase();
      if (remoteMemories) {
        this.memories = remoteMemories;
        saveState('memories', this.memories);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing memories:', err);
    }
  },

  async syncBorrowedItems() {
    if (!isSupabaseConfigured) return;
    try {
      const remoteBorrowed = await fetchBorrowedItemsFromSupabase();
      if (remoteBorrowed) {
        this.borrowed = remoteBorrowed;
        saveState('borrowed', this.borrowed);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing borrowed items:', err);
    }
  },

  async syncAttendanceAndReports() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    try {
      const collegeId = resolveCollegeId(this.currentUser.college);
      const [remoteAttendance, remoteReports] = await Promise.all([
        fetchDateAttendanceFromSupabase(this.currentUser.id, collegeId),
        fetchClassReportsFromSupabase(collegeId)
      ]);
      if (remoteAttendance) {
        this.dateAttendanceRecords = remoteAttendance;
        saveState('dateAttendanceRecords', this.dateAttendanceRecords);
      }
      if (remoteReports) {
        this.cancellationReports = remoteReports;
        saveState('cancellationReports', this.cancellationReports);
      }
      notifyListeners();
    } catch (err) {
      console.warn('Error syncing attendance & reports:', err);
    }
  },

  async syncSnaps() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    try {
      const remoteSnaps = await fetchSnapsFromSupabase(this.currentUser.id);
      if (remoteSnaps) {
        this.snaps = remoteSnaps;
        saveState('snaps', this.snaps);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing snaps:', err);
    }
  },

  async syncNotifications() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    try {
      const remoteNotifications = await fetchNotificationsFromSupabase(this.currentUser.id);
      if (remoteNotifications) {
        this.notifications = remoteNotifications;
        saveState('notifications', this.notifications);
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing notifications:', err);
    }
  },

  async syncAppSettings() {
    if (!isSupabaseConfigured) return;
    try {
      const remoteSettings = await fetchMemoryLockSettingsFromSupabase();
      if (remoteSettings) {
        const lockChanged = this.memoriesLocked !== remoteSettings.is_locked;
        this.memoriesLocked = remoteSettings.is_locked;
        this.memoriesPasscodeHash = remoteSettings.passcode_hash || DEFAULT_PASSCODE_HASH;
        saveState('memoriesLocked', this.memoriesLocked);
        saveState('memoriesPasscodeHash', this.memoriesPasscodeHash);
        
        if (lockChanged && this.memoriesLocked && !isUserAdmin(this.currentUser)) {
          this.sessionUnlockedMemories = false;
        }
        notifyListeners();
      }
    } catch (err) {
      console.warn('Error syncing app settings:', err);
    }
  },

  handleRemoteProfileUpdate(updatedProfile: Profile) {
    const exists = this.profiles.some(p => p.id === updatedProfile.id);
    if (exists) {
      this.profiles = this.profiles.map(p => p.id === updatedProfile.id ? { ...p, ...updatedProfile } : p);
    } else {
      this.profiles = [...this.profiles, updatedProfile];
    }

    if (this.currentUser && this.currentUser.id === updatedProfile.id) {
      this.currentUser = { ...this.currentUser, ...updatedProfile };
      saveState('currentUser', this.currentUser);
    }
    saveState('profiles', this.profiles);
    notifyListeners();
  },

  updateUserProfile(updatedData: Partial<Profile>) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, ...updatedData };
    this.profiles = this.profiles.map(p => p.id === this.currentUser.id ? this.currentUser : p);
    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);
    updateProfileInSupabase(this.currentUser.id, updatedData);
    notifyListeners();
  },

  markDateAttendance(
    dateStr: string,
    slotTime: string,
    subjectCode: string,
    subjectName: string,
    status: 'attended' | 'absent' | 'cancelled',
    reportedBy?: string
  ) {
    if (!this.currentUser) return;
    const collegeId = resolveCollegeId(this.currentUser.college);
    const existingIndex = this.dateAttendanceRecords.findIndex(
      r => r.user_id === this.currentUser.id && r.date === dateStr && r.slot_time === slotTime
    );

    if (existingIndex >= 0) {
      const updated = [...this.dateAttendanceRecords];
      updated[existingIndex] = {
        ...updated[existingIndex],
        status,
        reported_by: reportedBy,
        updated_at: new Date().toISOString(),
      };
      this.dateAttendanceRecords = updated;
    } else {
      const newRec: DateAttendanceRecord = {
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        user_id: this.currentUser.id,
        college_id: collegeId,
        date: dateStr,
        slot_time: slotTime,
        subject_code: subjectCode,
        subject_name: subjectName,
        status,
        reported_by: reportedBy,
        updated_at: new Date().toISOString(),
      };
      this.dateAttendanceRecords = [newRec, ...this.dateAttendanceRecords];
    }

    markDateAttendanceInSupabase({
      user_id: this.currentUser.id,
      college_id: collegeId,
      date: dateStr,
      slot_time: slotTime,
      subject_code: subjectCode,
      subject_name: subjectName,
      status: status
    });

    saveState('dateAttendanceRecords', this.dateAttendanceRecords);
    notifyListeners();
  },

  reportGroupCancellation(dateStr: string, slotTime: string, subjectCode: string, subjectName: string) {
    if (!this.currentUser) return;
    const collegeId = resolveCollegeId(this.currentUser.college);
    
    // Mark for current user
    this.markDateAttendance(dateStr, slotTime, subjectCode, subjectName, 'cancelled', this.currentUser.id);

    // Check existing group cancellation report
    const existingIndex = this.cancellationReports.findIndex(
      r => r.college_id === collegeId && r.date === dateStr && r.slot_time === slotTime
    );

    if (existingIndex >= 0) {
      const updated = [...this.cancellationReports];
      const prevConfirmed = updated[existingIndex].confirmed_by_user_ids;
      if (!prevConfirmed.includes(this.currentUser.id)) {
        updated[existingIndex].confirmed_by_user_ids = [...prevConfirmed, this.currentUser.id];
      }
      this.cancellationReports = updated;
    } else {
      const newReport: GroupCancellationReport = {
        id: `can-${Date.now()}`,
        college_id: collegeId,
        date: dateStr,
        slot_time: slotTime,
        subject_code: subjectCode,
        subject_name: subjectName,
        reported_by_user_id: this.currentUser.id,
        reported_by_name: this.currentUser.full_name,
        confirmed_by_user_ids: [this.currentUser.id],
        created_at: new Date().toISOString(),
      };
      this.cancellationReports = [newReport, ...this.cancellationReports];
    }

    reportClassCancellationInSupabase({
      college_id: collegeId,
      date: dateStr,
      slot_time: slotTime,
      subject_code: subjectCode,
      subject_name: subjectName,
      reported_by_user_id: this.currentUser.id,
      reported_by_name: this.currentUser.full_name
    });

    // Send notifications to group friends in the same college
    const collegeFriends = this.profiles.filter(
      p => p.id !== this.currentUser.id && resolveCollegeId(p.college) === collegeId
    );

    collegeFriends.forEach(f => {
      this.addNotification(
        f.id,
        'college',
        '⚠️ Class Cancellation Reported',
        `${this.currentUser.full_name} reported that ${subjectCode} (${slotTime}) on ${dateStr} didn't happen.`
      );
    });

    saveState('cancellationReports', this.cancellationReports);
    notifyListeners();
  },

  confirmGroupCancellation(reportId: string, confirm: boolean) {
    if (!this.currentUser) return;
    const report = this.cancellationReports.find(r => r.id === reportId);
    if (!report) return;

    if (confirm) {
      this.markDateAttendance(
        report.date,
        report.slot_time,
        report.subject_code,
        report.subject_name,
        'cancelled',
        report.reported_by_user_id
      );

      this.cancellationReports = this.cancellationReports.map(r => {
        if (r.id === reportId && !r.confirmed_by_user_ids.includes(this.currentUser.id)) {
          return { ...r, confirmed_by_user_ids: [...r.confirmed_by_user_ids, this.currentUser.id] };
        }
        return r;
      });
    }

    saveState('cancellationReports', this.cancellationReports);
    notifyListeners();
  },

  updateAttendance(subjectId: string, type: 'present' | 'absent') {
    this.timetable = this.timetable.map(s => {
      if (s.id === subjectId) {
        return {
          ...s,
          total_classes: (s.total_classes || 0) + 1,
          attended_classes: type === 'present' ? (s.attended_classes || 0) + 1 : (s.attended_classes || 0),
        };
      }
      return s;
    });
    saveState('timetable', this.timetable);
    notifyListeners();
  },

  toggleAssignment(id: string) {
    this.assignments = this.assignments.map(a => {
      if (a.id === id) {
        return { ...a, is_completed: !a.is_completed };
      }
      return a;
    });
    saveState('assignments', this.assignments);
    notifyListeners();
  },

  markSnapAsOpened(snapId: string) {
    this.openSnap(snapId);
  },

  // Auth Operations
  setCurrentUser(user: Profile) {
    this.currentUser = { ...user };
    const exists = this.profiles.some(p => p.id === user.id);
    if (exists) {
      this.profiles = this.profiles.map(p => p.id === user.id ? { ...p, ...user } : p);
    } else {
      this.profiles = [...this.profiles, user];
    }
    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);
    notifyListeners();
  },

  logout() {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
    this.currentUser = null as any;
    this.group = null;
    this.profiles = [];
    this.messages = [];
    this.expenses = [];
    this.loans = [];
    this.plans = [];
    this.borrowed = [];
    this.memories = [];
    this.dateAttendanceRecords = [];
    this.cancellationReports = [];
    this.assignments = [];
    this.snaps = [];
    this.notifications = [];
    this.sessionUnlockedMemories = false;
    localStorage.removeItem('friend_os_currentUser');
    localStorage.removeItem('friend_os_group');
    saveState('currentUser', null);
    notifyListeners();
  },

  // Update Status
  updateUserStatus(status_preset: Profile['status_preset'], custom_text?: string, expires_in_hours?: number) {
    if (!this.currentUser) return;
    const expires_at = expires_in_hours ? new Date(Date.now() + expires_in_hours * 3600000).toISOString() : null;
    const emoji = status_preset?.split(' ')[0] || '🟢';

    this.currentUser = {
      ...this.currentUser,
      status_preset,
      status_emoji: emoji,
      status_text: custom_text || status_preset,
      status_expires_at: expires_at,
    };

    this.profiles = this.profiles.map(p => p.id === this.currentUser.id ? this.currentUser : p);
    
    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);

    updateProfileInSupabase(this.currentUser.id, {
      status_preset,
      status_emoji: emoji,
      status_text: custom_text || status_preset,
      status_expires_at: expires_at
    });

    notifyListeners();
  },

  updateCurrentLocation(locationText: string) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, current_location: locationText };
    this.profiles = this.profiles.map(p => p.id === this.currentUser.id ? this.currentUser : p);
    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);

    updateProfileInSupabase(this.currentUser.id, {
      current_location: locationText
    });

    notifyListeners();
  },

  updatePaymentQr(qrUrl: string, upiId: string) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, payment_qr_url: qrUrl, upi_id: upiId };
    this.profiles = this.profiles.map(p => p.id === this.currentUser.id ? this.currentUser : p);
    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);

    updateProfileInSupabase(this.currentUser.id, {
      payment_qr_url: qrUrl,
      upi_id: upiId
    });

    notifyListeners();
  },

  // Chat Actions
  async addMessage(category: ChatCategory, content: string, media_url?: string, reply_to_id?: string) {
    if (!this.currentUser) return;
    const replyMsg = reply_to_id ? this.messages.find(m => m.id === reply_to_id) : undefined;
    const senderProfile = this.currentUser;
    const groupId = this.group?.id || 'main-group';
    const tempId = `msg-${Date.now()}`;

    const newMsg: ChatMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: this.currentUser.id,
      category,
      content,
      media_url: media_url || null,
      reply_to_id: reply_to_id || null,
      reply_to_message: replyMsg ? {
        sender_name: this.profiles.find(p => p.id === replyMsg.sender_id)?.full_name || 'User',
        content: replyMsg.content
      } : null,
      reactions: {},
      created_at: new Date().toISOString(),
      sender: senderProfile,
    };

    this.messages = [...this.messages, newMsg];
    saveState('messages', this.messages);
    notifyListeners();

    const remoteMsg = await sendMessageToSupabase({
      group_id: groupId,
      sender_id: this.currentUser.id,
      category,
      content,
      media_url,
      reply_to_id
    });

    if (remoteMsg) {
      this.messages = this.messages.map(m => m.id === tempId ? { ...remoteMsg, sender: senderProfile } : m);
      saveState('messages', this.messages);
      notifyListeners();
    }

    return newMsg;
  },

  toggleReaction(messageId: string, emoji: string) {
    if (!this.currentUser) return;
    const userId = this.currentUser.id;
    this.messages = this.messages.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = { ...msg.reactions };
      const currentUsers = reactions[emoji] || [];
      
      if (currentUsers.includes(userId)) {
        reactions[emoji] = currentUsers.filter(id => id !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...currentUsers, userId];
      }

      return { ...msg, reactions };
    });

    saveState('messages', this.messages);
    notifyListeners();
  },

  deleteMessage(messageId: string) {
    if (!this.currentUser) return;
    this.messages = this.messages.filter(m => m.id !== messageId || m.sender_id === this.currentUser.id);
    saveState('messages', this.messages);
    notifyListeners();
  },

  // Expenses & Loans Actions
  async addGroupExpense(title: string, total_amount: number, category: string, participant_ids: string[]) {
    if (!this.currentUser) return;
    const share = Number((total_amount / (participant_ids.length || 1)).toFixed(2));
    const groupId = this.group?.id || 'main-group';
    const tempId = `exp-${Date.now()}`;

    const newExpense: GroupExpense = {
      id: tempId,
      group_id: groupId,
      paid_by: this.currentUser.id,
      title,
      total_amount,
      category,
      participants: participant_ids.map(uid => ({
        user_id: uid,
        share_amount: share,
        status: uid === this.currentUser.id ? 'settled' : 'pending',
      })),
      created_at: new Date().toISOString(),
      payer_profile: this.currentUser,
    };

    this.expenses = [newExpense, ...this.expenses];
    saveState('expenses', this.expenses);
    notifyListeners();

    // Auto post to chat
    this.addMessage('money', `💰 Added expense "${title}" (Total: ₹${total_amount}). Shares: ₹${share} each.`);

    // Send notifications to other participants
    participant_ids.forEach(uid => {
      if (uid !== this.currentUser?.id) {
        this.addNotification(
          uid,
          'expense',
          '💰 New Shared Expense',
          `${this.currentUser?.full_name} added "${title}". Your share is ₹${share}.`
        );
      }
    });

    const remoteExp = await addExpenseToSupabase({
      group_id: groupId,
      paid_by: this.currentUser.id,
      title,
      total_amount,
      category,
      participants: participant_ids.map(uid => ({
        user_id: uid,
        share_amount: share,
        status: uid === this.currentUser.id ? 'settled' : 'pending'
      }))
    });

    if (remoteExp) {
      this.expenses = this.expenses.map(e => e.id === tempId ? { ...remoteExp, payer_profile: this.currentUser } : e);
      saveState('expenses', this.expenses);
      notifyListeners();
    }
  },

  async addPersonalLoan(borrower_id: string, amount: number, reason: string, category: PersonalLoan['category']) {
    if (!this.currentUser) return;
    const tempId = `loan-${Date.now()}`;
    const borrower = this.profiles.find(p => p.id === borrower_id);

    const newLoan: PersonalLoan = {
      id: tempId,
      lender_id: this.currentUser.id,
      borrower_id,
      amount,
      reason,
      category,
      status: 'pending',
      created_at: new Date().toISOString(),
      lender_profile: this.currentUser,
      borrower_profile: borrower,
    };

    this.loans = [newLoan, ...this.loans];
    saveState('loans', this.loans);
    notifyListeners();

    // Send notification to borrower
    this.addNotification(
      borrower_id,
      'expense',
      '🤝 New Loan Added',
      `${this.currentUser.full_name} recorded a loan of ₹${amount} for "${reason}".`
    );

    const remoteLoan = await addLoanToSupabase({
      lender_id: this.currentUser.id,
      borrower_id,
      amount,
      reason,
      category
    });

    if (remoteLoan) {
      this.loans = this.loans.map(l => l.id === tempId ? { ...remoteLoan, lender_profile: this.currentUser, borrower_profile: borrower } : l);
      saveState('loans', this.loans);
      notifyListeners();
    }
  },

  async markLoanAsPaid(loanId: string) {
    const targetLoan = this.loans.find(l => l.id === loanId);
    this.loans = this.loans.map(loan => {
      if (loan.id === loanId) {
        return {
          ...loan,
          status: 'paid',
          paid_at: new Date().toISOString()
        };
      }
      return loan;
    });

    saveState('loans', this.loans);
    notifyListeners();

    await settleLoanInSupabase(loanId);

    // Cross-user notification
    if (targetLoan && this.currentUser) {
      const isBorrower = this.currentUser.id === targetLoan.borrower_id;
      const recipientId = isBorrower ? targetLoan.lender_id : targetLoan.borrower_id;
      const message = isBorrower
        ? `${this.currentUser.full_name} marked loan of ₹${targetLoan.amount} (${targetLoan.reason}) as paid.`
        : `${this.currentUser.full_name} confirmed receipt of ₹${targetLoan.amount} payment.`;

      this.addNotification(recipientId, 'payment', '✅ Loan Settled', message);
    }
  },

  async settleExpenseShare(expenseId: string, userId: string) {
    const targetExpense = this.expenses.find(e => e.id === expenseId);
    this.expenses = this.expenses.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        participants: exp.participants.map(p => p.user_id === userId ? { ...p, status: 'settled' } : p)
      };
    });

    saveState('expenses', this.expenses);
    notifyListeners();

    await settleExpenseShareInSupabase(expenseId, userId);

    if (targetExpense && this.currentUser && targetExpense.paid_by !== userId) {
      this.addNotification(
        targetExpense.paid_by,
        'payment',
        '✅ Expense Share Settled',
        `${this.currentUser.full_name} settled their share for "${targetExpense.title}".`
      );
    }
  },

  // Plans & Polls
  async createPlan(title: string, date: string, time: string, location: string, description?: string) {
    if (!this.currentUser) return;
    const groupId = this.group?.id || 'main-group';
    const tempId = `plan-${Date.now()}`;

    const newPlan: GroupPlan = {
      id: tempId,
      group_id: groupId,
      creator_id: this.currentUser.id,
      title,
      date,
      time,
      location,
      description,
      status: 'upcoming',
      participants: [{ user_id: this.currentUser.id, status: 'joined' }],
      created_at: new Date().toISOString(),
      creator_profile: this.currentUser,
    };

    this.plans = [newPlan, ...this.plans];
    saveState('plans', this.plans);
    notifyListeners();

    // Auto post to #plans chat
    this.addMessage('plans', `📅 New Group Plan: "${title}" on ${date} at ${time} (${location})!`);

    // Notify all other friends
    this.profiles.forEach(p => {
      if (p.id !== this.currentUser?.id) {
        this.addNotification(
          p.id,
          'plan',
          '📅 New Group Plan',
          `${this.currentUser?.full_name} created plan "${title}" on ${date} at ${time}.`
        );
      }
    });

    const remotePlan = await addPlanToSupabase({
      group_id: groupId,
      creator_id: this.currentUser.id,
      title,
      date,
      time,
      location,
      description
    });

    if (remotePlan) {
      this.plans = this.plans.map(p => p.id === tempId ? { ...remotePlan, creator_profile: this.currentUser } : p);
      saveState('plans', this.plans);
      notifyListeners();
    }
  },

  async updatePlanStatus(planId: string, status: 'joined' | 'declined' | 'maybe') {
    if (!this.currentUser) return;
    const targetPlan = this.plans.find(p => p.id === planId);

    this.plans = this.plans.map(p => {
      if (p.id !== planId) return p;
      const existing = p.participants.filter(part => part.user_id !== this.currentUser.id);
      return {
        ...p,
        participants: [...existing, { user_id: this.currentUser.id, status }]
      };
    });

    saveState('plans', this.plans);
    notifyListeners();

    await updatePlanRsvpInSupabase(planId, this.currentUser.id, status);

    if (targetPlan && targetPlan.creator_id !== this.currentUser.id && status === 'joined') {
      this.addNotification(
        targetPlan.creator_id,
        'plan',
        '🎉 Friend Joined Plan',
        `${this.currentUser.full_name} RSVP'd joined for "${targetPlan.title}".`
      );
    }
  },

  async addPollToPlan(planId: string, question: string, optionTexts: string[], allow_multiple = false) {
    const pollId = `poll-${Date.now()}`;
    const newPoll: PlanPoll = {
      id: pollId,
      plan_id: planId,
      question,
      allow_multiple,
      options: optionTexts.map((text, idx) => ({ id: `opt-${idx}-${Date.now()}`, text, votes: [] })),
    };

    this.plans = this.plans.map(p => {
      if (p.id !== planId) return p;
      return {
        ...p,
        polls: [...(p.polls || []), newPoll]
      };
    });

    saveState('plans', this.plans);
    notifyListeners();

    await addPollToPlanInSupabase(planId, question, optionTexts, allow_multiple);
    this.syncPlans();
  },

  async votePollOption(planId: string, pollId: string, optionId: string) {
    if (!this.currentUser) return;
    const userId = this.currentUser.id;
    this.plans = this.plans.map(p => {
      if (p.id !== planId || !p.polls) return p;
      
      const updatedPolls = p.polls.map(poll => {
        if (poll.id !== pollId) return poll;

        const updatedOptions = poll.options.map(opt => {
          if (opt.id === optionId) {
            const hasVoted = opt.votes.includes(userId);
            return {
              ...opt,
              votes: hasVoted ? opt.votes.filter(id => id !== userId) : [...opt.votes, userId]
            };
          } else if (!poll.allow_multiple) {
            return {
              ...opt,
              votes: opt.votes.filter(id => id !== userId)
            };
          }
          return opt;
        });

        return { ...poll, options: updatedOptions };
      });

      return { ...p, polls: updatedPolls };
    });

    saveState('plans', this.plans);
    notifyListeners();

    await votePollOptionInSupabase(pollId, optionId, userId);
  },

  // Memories
  async addMemory(title: string, caption: string, media_urls: string[], date: string, location?: string, tagged_user_ids: string[] = []) {
    if (!this.currentUser) return;
    const groupId = this.group?.id || 'main-group';
    const tempId = `mem-${Date.now()}`;

    const newMem: Memory = {
      id: tempId,
      group_id: groupId,
      creator_id: this.currentUser.id,
      title,
      caption,
      media_urls,
      date,
      location,
      tagged_user_ids,
      created_at: new Date().toISOString(),
      creator_profile: this.currentUser,
    };

    this.memories = [newMem, ...this.memories];
    saveState('memories', this.memories);
    notifyListeners();
    
    this.addMessage('memories', `📸 Shared new group memory: "${title}" (${date})!`);

    // Notify tagged users
    tagged_user_ids.forEach(uid => {
      if (uid !== this.currentUser?.id) {
        this.addNotification(
          uid,
          'message',
          '🏷️ Tagged in Memory',
          `${this.currentUser?.full_name} tagged you in a memory: "${title}".`
        );
      }
    });

    const remoteMem = await addMemoryToSupabase({
      group_id: groupId,
      creator_id: this.currentUser.id,
      title,
      caption,
      media_urls,
      date,
      location,
      tagged_user_ids
    });

    if (remoteMem) {
      this.memories = this.memories.map(m => m.id === tempId ? { ...remoteMem, creator_profile: this.currentUser } : m);
      saveState('memories', this.memories);
      notifyListeners();
    }
  },

  async toggleMemoriesLock(isLocked: boolean): Promise<boolean> {
    if (!isUserAdmin(this.currentUser)) {
      console.warn('Unauthorized: Only group administrator can lock/unlock memories.');
      return false;
    }
    this.memoriesLocked = isLocked;
    if (isLocked) {
      this.sessionUnlockedMemories = false;
    }
    saveState('memoriesLocked', this.memoriesLocked);
    notifyListeners();

    await updateMemoryLockInSupabase(isLocked, this.currentUser.id, this.memoriesPasscodeHash);
    return true;
  },

  async changeMemoriesPasscode(newPasscode: string): Promise<boolean> {
    if (!isUserAdmin(this.currentUser)) {
      console.warn('Unauthorized: Only group administrator can change memories passcode.');
      return false;
    }
    const cleanPasscode = newPasscode.trim();
    if (!cleanPasscode) return false;

    const hash = await computeSha256(cleanPasscode);
    this.memoriesPasscodeHash = hash;
    saveState('memoriesPasscodeHash', this.memoriesPasscodeHash);
    notifyListeners();

    await updateMemoryPasscodeInSupabase(hash, this.currentUser.id, this.memoriesLocked);
    return true;
  },

  async unlockMemoriesWithPasscode(inputPasscode: string): Promise<boolean> {
    const cleanPasscode = inputPasscode.trim();
    if (!cleanPasscode) return false;

    const hash = await computeSha256(cleanPasscode);
    const isDefaultMatch = cleanPasscode === '0000';
    if (hash === this.memoriesPasscodeHash || isDefaultMatch) {
      this.sessionUnlockedMemories = true;
      notifyListeners();
      return true;
    }
    return false;
  },

  // Borrowed Tracker
  async addBorrowedItem(owner_id: string, borrower_id: string, item_name: string, expected_return_date: string) {
    const tempId = `bor-${Date.now()}`;
    const owner = this.profiles.find(p => p.id === owner_id);
    const borrower = this.profiles.find(p => p.id === borrower_id);

    const newItem: BorrowedItem = {
      id: tempId,
      owner_id,
      borrower_id,
      item_name,
      borrowed_date: new Date().toISOString().split('T')[0],
      expected_return_date,
      status: 'borrowed',
      created_at: new Date().toISOString(),
      owner_profile: owner,
      borrower_profile: borrower,
    };

    this.borrowed = [newItem, ...this.borrowed];
    saveState('borrowed', this.borrowed);
    notifyListeners();

    // Cross-user notification
    if (this.currentUser) {
      const isBorrower = this.currentUser.id === borrower_id;
      const otherUserId = isBorrower ? owner_id : borrower_id;
      const msg = isBorrower
        ? `${this.currentUser.full_name} borrowed "${item_name}" from you.`
        : `${this.currentUser.full_name} lent you "${item_name}".`;

      this.addNotification(otherUserId, 'borrowed', '📦 Borrowed Item Recorded', msg);
    }

    const remoteItem = await addBorrowedItemToSupabase({
      owner_id,
      borrower_id,
      item_name,
      expected_return_date
    });

    if (remoteItem) {
      this.borrowed = this.borrowed.map(b => b.id === tempId ? { ...remoteItem, owner_profile: owner, borrower_profile: borrower } : b);
      saveState('borrowed', this.borrowed);
      notifyListeners();
    }
  },

  async markItemReturned(itemId: string) {
    const targetItem = this.borrowed.find(b => b.id === itemId);
    this.borrowed = this.borrowed.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: 'returned',
          returned_at: new Date().toISOString()
        };
      }
      return item;
    });

    saveState('borrowed', this.borrowed);
    notifyListeners();

    await markItemReturnedInSupabase(itemId);

    if (targetItem && this.currentUser) {
      const isBorrower = this.currentUser.id === targetItem.borrower_id;
      const otherUserId = isBorrower ? targetItem.owner_id : targetItem.borrower_id;
      const msg = `${this.currentUser.full_name} marked "${targetItem.item_name}" as returned.`;

      this.addNotification(otherUserId, 'borrowed', '📦 Item Returned', msg);
    }
  },

  // Important Dates & Birthdays
  addImportantDate(title: string, date: string, category: ImportantDate['category'], associated_user_id?: string) {
    if (!this.currentUser) return;
    const groupId = this.group?.id || 'main-group';
    const newDate: ImportantDate = {
      id: `date-${Date.now()}`,
      group_id: groupId,
      created_by: this.currentUser.id,
      title,
      date,
      category,
      user_id: associated_user_id || null,
      created_at: new Date().toISOString(),
    };

    this.importantDates = [...this.importantDates, newDate];
    saveState('importantDates', this.importantDates);
    notifyListeners();
  },

  // Snaps (Disappearing 1-Time Photos)
  async sendSnap(recipient_id: string, image_url: string, caption?: string) {
    if (!this.currentUser) return;
    const tempId = `snap-${Date.now()}`;

    const newSnap: SnapMessage = {
      id: tempId,
      sender_id: this.currentUser.id,
      recipient_id,
      image_url,
      caption,
      sent_at: new Date().toISOString(),
      status: 'sent',
      sender_profile: this.currentUser,
    };

    this.snaps = [newSnap, ...this.snaps];
    saveState('snaps', this.snaps);
    notifyListeners();

    const recipient = this.profiles.find(p => p.id === recipient_id);
    if (recipient) {
      this.addNotification(recipient_id, 'snap', '📸 New Disappearing Snap', `${this.currentUser.full_name} sent you a snap. Tap to view once.`);
    }

    const remoteSnap = await sendSnapToSupabase(this.currentUser.id, recipient_id, image_url, caption);
    if (remoteSnap) {
      this.snaps = this.snaps.map(s => s.id === tempId ? { ...remoteSnap, sender_profile: this.currentUser } : s);
      saveState('snaps', this.snaps);
      notifyListeners();
    }

    return newSnap;
  },

  async openSnap(snapId: string) {
    const targetSnap = this.snaps.find(s => s.id === snapId);
    this.snaps = this.snaps.map(snap => {
      if (snap.id === snapId) {
        return {
          ...snap,
          status: 'opened',
          opened_at: new Date().toISOString()
        };
      }
      return snap;
    });

    saveState('snaps', this.snaps);
    notifyListeners();

    await openSnapInSupabase(snapId);

    if (targetSnap && this.currentUser && targetSnap.sender_id !== this.currentUser.id) {
      this.addNotification(
        targetSnap.sender_id,
        'snap_opened',
        '📸 Snap Opened',
        `${this.currentUser.full_name} opened your snap.`
      );
    }
  },

  async destroySnap(snapId: string) {
    this.snaps = this.snaps.map(snap => {
      if (snap.id === snapId) {
        return {
          ...snap,
          image_url: '',
          status: 'expired',
          expires_at: new Date().toISOString()
        };
      }
      return snap;
    });

    saveState('snaps', this.snaps);
    notifyListeners();

    await destroySnapInSupabase(snapId);
  },

  // Notifications
  addNotification(user_id: string, type: AppNotification['type'], title: string, message: string, link?: string) {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      user_id,
      type,
      title,
      message,
      link,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // If for current user, add to local notifications state
    if (this.currentUser && user_id === this.currentUser.id) {
      this.notifications = [newNotif, ...this.notifications];
      saveState('notifications', this.notifications);
      notifyListeners();
    }

    addNotificationToSupabase({
      user_id,
      type,
      title,
      message,
      link
    });
  },

  async markNotificationsAsRead() {
    if (!this.currentUser) return;
    this.notifications = this.notifications.map(n => n.user_id === this.currentUser?.id ? { ...n, is_read: true } : n);
    saveState('notifications', this.notifications);
    notifyListeners();

    await markNotificationsReadInSupabase(this.currentUser.id);
  }
};

export function useAppStore() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    return appStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return appStore;
}
