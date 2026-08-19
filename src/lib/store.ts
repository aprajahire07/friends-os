import { useState, useEffect } from 'react';
import { 
  Profile, 
  GroupMember, 
  ChatMessage, 
  GroupExpense, 
  ExpenseParticipant,
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
  FriendGroup,
  Note,
  NoteFile
} from '../types';
import { resolveCollegeId, GHRCE_COLLEGE_ID, SKILLTECH_COLLEGE_ID } from './timetables';
import { supabase, isSupabaseConfigured } from './supabase';
import { dedupeAsync, withTimeout } from './asyncUtils';
import { fetchProfilesFromSupabase, updateProfileInSupabase, sanitizeCollege } from '../services/profiles';
import { 
  fetchMessagesFromSupabase, 
  sendMessageToSupabase, 
  clearMessagesFromSupabase,
  fetchMessageReadsFromSupabase, 
  markCategoryAsReadInSupabase,
  markAllCategoriesAsReadInSupabase 
} from '../services/chat';
import { 
  fetchExpensesFromSupabase, 
  addExpenseToSupabase, 
  updateExpenseInSupabase,
  deleteExpenseFromSupabase,
  fetchLoansFromSupabase, 
  addLoanToSupabase, 
  updateLoanInSupabase,
  deleteLoanFromSupabase,
  claimLoanPaymentInSupabase,
  confirmLoanPaymentInSupabase, 
  rejectLoanPaymentClaimInSupabase,
  settleLoanInSupabase, 
  claimExpenseShareInSupabase,
  settleExpenseShareInSupabase,
  rejectExpenseShareClaimInSupabase
} from '../services/expenses';
import { 
  fetchPlansFromSupabase, 
  addPlanToSupabase, 
  updatePlanRsvpInSupabase, 
  votePollOptionInSupabase, 
  addPollToPlanInSupabase,
  deletePlanFromSupabase
} from '../services/plans';
import { fetchMemoriesFromSupabase, addMemoryToSupabase, updateMemoryInSupabase, deleteMemoryFromSupabase } from '../services/memories';
import { extractYouTubeVideoId } from './youtube';
import { fetchNotesFromSupabase, createNoteInSupabase, deleteNoteFromSupabase, verifyNotePasswordInSupabase } from '../services/notes';
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
  isMasterAdmin,
  DEFAULT_PASSCODE_HASH,
  fetchProfileOverridesFromSupabase,
  updateProfileOverrideInSupabase
} from '../services/appSettings';
import {
  adminSetUserBanStatus,
  adminClearCompletedMoneyHistory as apiAdminClearCompletedMoneyHistory,
  adminInitiateUserPasswordReset as apiAdminInitiateUserPasswordReset,
  adminChangeMemoriesPasscode as apiAdminChangeMemoriesPasscode,
  adminToggleMemoriesLock as apiAdminToggleMemoriesLock,
  verifyMemoriesPasscodeSecurely
} from '../services/admin';

// Helper to safely load from local storage
function loadInitialState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(`friend_os_${key}`);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    if (key === 'currentUser' && parsed && typeof parsed === 'object') {
      parsed.college = sanitizeCollege(parsed.college);
      if (parsed.email && parsed.email.toLowerCase().trim() === 'shreyashjivtode2@gmail.com') {
        parsed.full_name = 'Shreyash jivtode';
      }
    } else if (key === 'profiles' && Array.isArray(parsed)) {
      parsed.forEach((p: any) => {
        if (p) {
          p.college = sanitizeCollege(p.college);
          if (p.email && p.email.toLowerCase().trim() === 'shreyashjivtode2@gmail.com') {
            p.full_name = 'Shreyash jivtode';
          }
        }
      });
    }
    return parsed;
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
  notes: loadInitialState<Note[]>('notes', []),
  unlockedNoteIds: new Set<string>(),
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
  messageReads: loadInitialState<Record<string, string>>('messageReads', {}),
  clearedChats: loadInitialState<Record<string, string>>('clearedChats', {}),
  
  // Memories Lock & Security (Admin controlled)
  memoriesLocked: loadInitialState<boolean>('memoriesLocked', true),
  memoriesPasscodeHash: loadInitialState<string>('memoriesPasscodeHash', DEFAULT_PASSCODE_HASH),
  sessionUnlockedMemories: false,

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async syncFromSupabase() {
    if (!isSupabaseConfigured || !this.currentUser) return;

    return dedupeAsync('syncFromSupabase', async () => {
      try {
        const collegeId = resolveCollegeId(this.currentUser.college);
        const [
          remoteProfiles,
          remoteMessages,
          remoteExpenses,
          remoteLoans,
          remotePlans,
          remoteMemories,
          remoteNotes,
          remoteBorrowed,
          remoteAttendance,
          remoteReports,
          remoteSnaps,
          remoteNotifications,
          remoteSettings,
          remoteGroupData,
          remoteMessageReads
        ] = await withTimeout(
          Promise.all([
            fetchProfilesFromSupabase(),
            fetchMessagesFromSupabase(),
            fetchExpensesFromSupabase(),
            fetchLoansFromSupabase(),
            fetchPlansFromSupabase(),
            fetchMemoriesFromSupabase(),
            fetchNotesFromSupabase(),
            fetchBorrowedItemsFromSupabase(),
            fetchDateAttendanceFromSupabase(this.currentUser.id, collegeId),
            fetchClassReportsFromSupabase(collegeId),
            fetchSnapsFromSupabase(this.currentUser.id),
            fetchNotificationsFromSupabase(this.currentUser.id),
            fetchMemoryLockSettingsFromSupabase(),
            fetchUserGroup(this.currentUser.id),
            fetchMessageReadsFromSupabase(this.currentUser.id)
          ]),
          8000,
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]
        );

        const localReads = loadInitialState<Record<string, string>>(`messageReads_${this.currentUser.id}`, {});
        const mergedReads: Record<string, string> = { ...localReads };
        if (remoteMessageReads) {
          for (const [cat, time] of Object.entries(remoteMessageReads)) {
            if (!mergedReads[cat] || new Date(time).getTime() > new Date(mergedReads[cat]).getTime()) {
              mergedReads[cat] = time;
            }
          }
        }
        this.messageReads = mergedReads;
        saveState(`messageReads_${this.currentUser.id}`, this.messageReads);

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
          const currentMatched = this.profiles.find(p => p.id === this.currentUser?.id);
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
        if (remoteNotes) {
          this.notes = remoteNotes;
          saveState('notes', this.notes);
        }
        if (remoteBorrowed) this.borrowed = remoteBorrowed;
        if (remoteAttendance) this.dateAttendanceRecords = remoteAttendance;
        if (remoteReports) this.cancellationReports = remoteReports;
        if (remoteSnaps) this.snaps = remoteSnaps;
        if (remoteNotifications) this.notifications = remoteNotifications;

        notifyListeners();
      } catch (err) {
        console.warn('Sync from Supabase completed with note:', err);
      }
    });
  },

  async syncProfiles() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncProfiles', async () => {
      try {
        const remoteProfiles = await withTimeout(fetchProfilesFromSupabase(), 8000, null);
        if (remoteProfiles && remoteProfiles.length > 0) {
          this.profiles = remoteProfiles;
          if (this.currentUser) {
            const currentMatched = this.profiles.find(p => p.id === this.currentUser.id);
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
    });
  },

  async syncMessages() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    return dedupeAsync('syncMessages', async () => {
      try {
        const remoteMessages = await withTimeout(fetchMessagesFromSupabase(), 8000, null);
        if (remoteMessages) {
          // Build sender profile lookup
          const profileMap = new Map(this.profiles.map(p => [p.id, p]));
          if (this.currentUser) profileMap.set(this.currentUser.id, this.currentUser);

          const enrichedRemote = remoteMessages.map(m => ({
            ...m,
            sender: profileMap.get(m.sender_id) || m.sender,
            recipient: m.recipient_id ? profileMap.get(m.recipient_id) || m.recipient : undefined
          }));

          // Preserve optimistic local messages that are still pending
          const pendingOptimistic = this.messages.filter(
            m => m.id.startsWith('msg-') && !enrichedRemote.some(rm => rm.id === m.id)
          );

          // Merge and sort
          const combined = [...enrichedRemote, ...pendingOptimistic].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          this.messages = combined;
          saveState('messages', this.messages);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing messages:', err);
      }
    });
  },

  async syncMessageReads() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    return dedupeAsync('syncMessageReads', async () => {
      try {
        const remoteReads = await withTimeout(fetchMessageReadsFromSupabase(this.currentUser.id), 8000, null);
        const localReads = loadInitialState<Record<string, string>>(`messageReads_${this.currentUser.id}`, {});
        const merged: Record<string, string> = { ...localReads };
        if (remoteReads) {
          for (const [cat, time] of Object.entries(remoteReads)) {
            if (!merged[cat] || new Date(time).getTime() > new Date(merged[cat]).getTime()) {
              merged[cat] = time;
            }
          }
        }
        this.messageReads = merged;
        saveState(`messageReads_${this.currentUser.id}`, this.messageReads);
        notifyListeners();
      } catch (err) {
        console.warn('Error syncing message reads:', err);
      }
    });
  },

  async syncExpensesAndLoans() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncExpensesAndLoans', async () => {
      try {
        const [remoteExpenses, remoteLoans] = await withTimeout(
          Promise.all([
            fetchExpensesFromSupabase(),
            fetchLoansFromSupabase()
          ]),
          8000,
          [null, null]
        );
        let changed = false;
        if (remoteExpenses) {
          const tempPending = this.expenses.filter(
            e => e.id.startsWith('exp-') && !remoteExpenses.some(re => re.id === e.id)
          );
          this.expenses = [...tempPending, ...remoteExpenses];
          saveState('expenses', this.expenses);
          changed = true;
        }
        if (remoteLoans) {
          const tempPendingLoans = this.loans.filter(
            l => l.id.startsWith('loan-') && !remoteLoans.some(rl => rl.id === l.id)
          );
          this.loans = [...tempPendingLoans, ...remoteLoans];
          saveState('loans', this.loans);
          changed = true;
        }
        if (changed) {
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing expenses/loans:', err);
      }
    });
  },

  async syncPlans() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncPlans', async () => {
      try {
        const remotePlans = await withTimeout(fetchPlansFromSupabase(), 8000, null);
        if (remotePlans) {
          this.plans = remotePlans;
          saveState('plans', this.plans);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing plans:', err);
      }
    });
  },

  async syncMemories() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncMemories', async () => {
      try {
        const remoteMemories = await withTimeout(fetchMemoriesFromSupabase(), 8000, null);
        if (remoteMemories) {
          const hydrated = remoteMemories.map(m => {
            if (!m.creator_profile) {
              const matchedProfile = this.profiles.find(p => p.id === m.creator_id);
              if (matchedProfile) {
                return { ...m, creator_profile: matchedProfile };
              }
            }
            return m;
          });
          this.memories = hydrated;
          saveState('memories', this.memories);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing memories:', err);
      }
    });
  },

  async syncNotes() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncNotes', async () => {
      try {
        const remoteNotes = await withTimeout(fetchNotesFromSupabase(), 8000, null);
        if (remoteNotes) {
          const hydrated = remoteNotes.map(n => {
            if (!n.uploader_profile) {
              const matchedProfile = this.profiles.find(p => p.id === n.uploaded_by);
              if (matchedProfile) {
                return { ...n, uploader_profile: matchedProfile };
              }
            }
            return n;
          });
          this.notes = hydrated;
          saveState('notes', this.notes);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing notes:', err);
      }
    });
  },

  async syncBorrowedItems() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncBorrowedItems', async () => {
      try {
        const remoteBorrowed = await withTimeout(fetchBorrowedItemsFromSupabase(), 8000, null);
        if (remoteBorrowed) {
          this.borrowed = remoteBorrowed;
          saveState('borrowed', this.borrowed);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing borrowed items:', err);
      }
    });
  },

  async syncAttendanceAndReports() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    return dedupeAsync('syncAttendanceAndReports', async () => {
      try {
        const collegeId = resolveCollegeId(this.currentUser.college);
        const [remoteAttendance, remoteReports] = await withTimeout(
          Promise.all([
            fetchDateAttendanceFromSupabase(this.currentUser.id, collegeId),
            fetchClassReportsFromSupabase(collegeId)
          ]),
          8000,
          [null, null]
        );
        let changed = false;
        if (remoteAttendance) {
          this.dateAttendanceRecords = remoteAttendance;
          saveState('dateAttendanceRecords', this.dateAttendanceRecords);
          changed = true;
        }
        if (remoteReports) {
          this.cancellationReports = remoteReports;
          saveState('cancellationReports', this.cancellationReports);
          changed = true;
        }
        if (changed) {
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing attendance & reports:', err);
      }
    });
  },

  async syncSnaps() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    return dedupeAsync('syncSnaps', async () => {
      try {
        const remoteSnaps = await withTimeout(fetchSnapsFromSupabase(this.currentUser.id), 8000, null);
        if (remoteSnaps) {
          this.snaps = remoteSnaps;
          saveState('snaps', this.snaps);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing snaps:', err);
      }
    });
  },

  async syncNotifications() {
    if (!isSupabaseConfigured || !this.currentUser) return;
    return dedupeAsync('syncNotifications', async () => {
      try {
        const remoteNotifications = await withTimeout(fetchNotificationsFromSupabase(this.currentUser.id), 8000, null);
        if (remoteNotifications) {
          this.notifications = remoteNotifications;
          saveState('notifications', this.notifications);
          notifyListeners();
        }
      } catch (err) {
        console.warn('Error syncing notifications:', err);
      }
    });
  },

  async syncAppSettings() {
    if (!isSupabaseConfigured) return;
    return dedupeAsync('syncAppSettings', async () => {
      try {
        const [remoteSettings, remoteOverrides] = await Promise.all([
          withTimeout(fetchMemoryLockSettingsFromSupabase(), 8000, null),
          withTimeout(fetchProfileOverridesFromSupabase(), 8000, null)
        ]);

        let hasProfileChanges = false;

        if (remoteSettings) {
          const lockChanged = this.memoriesLocked !== remoteSettings.is_locked;
          this.memoriesLocked = remoteSettings.is_locked;
          this.memoriesPasscodeHash = remoteSettings.passcode_hash || DEFAULT_PASSCODE_HASH;
          saveState('memoriesLocked', this.memoriesLocked);
          saveState('memoriesPasscodeHash', this.memoriesPasscodeHash);
          
          if (lockChanged && this.memoriesLocked && !isUserAdmin(this.currentUser)) {
            this.sessionUnlockedMemories = false;
          }
        }

        // Apply profile overrides across all cached profiles and current user
        if (remoteOverrides && Object.keys(remoteOverrides).length > 0) {
          this.profiles = this.profiles.map(p => {
            const emailLower = (p.email || '').toLowerCase().trim();
            const override = remoteOverrides[p.id] || (emailLower ? remoteOverrides[`email:${emailLower}`] : undefined);
            if (override) {
              hasProfileChanges = true;
              return {
                ...p,
                ...(override.full_name ? { full_name: override.full_name } : {}),
                ...(override.username ? { username: override.username } : {}),
                ...(override.birthday ? { birthday: override.birthday } : {}),
                ...(override.college ? { college: sanitizeCollege(override.college) } : {}),
                ...(override.course_branch ? { course_branch: override.course_branch } : {}),
                ...(override.avatar_url ? { avatar_url: override.avatar_url } : {}),
                ...(override.role ? { role: override.role } : {})
              };
            }
            return p;
          });

          if (this.currentUser) {
            const myEmailLower = (this.currentUser.email || '').toLowerCase().trim();
            const myOverride = remoteOverrides[this.currentUser.id] || (myEmailLower ? remoteOverrides[`email:${myEmailLower}`] : undefined);
            if (myOverride) {
              const updatedMe = {
                ...this.currentUser,
                ...(myOverride.full_name ? { full_name: myOverride.full_name } : {}),
                ...(myOverride.username ? { username: myOverride.username } : {}),
                ...(myOverride.birthday ? { birthday: myOverride.birthday } : {}),
                ...(myOverride.college ? { college: sanitizeCollege(myOverride.college) } : {}),
                ...(myOverride.course_branch ? { course_branch: myOverride.course_branch } : {}),
                ...(myOverride.avatar_url ? { avatar_url: myOverride.avatar_url } : {}),
                ...(myOverride.role ? { role: myOverride.role } : {})
              };
              this.currentUser = updatedMe;
              saveState('currentUser', this.currentUser);

              // Auto-sync into own row in Supabase since current user has owner RLS permissions
              updateProfileInSupabase(this.currentUser.id, {
                full_name: updatedMe.full_name,
                username: updatedMe.username,
                birthday: updatedMe.birthday,
                college: updatedMe.college
              }).catch(() => {});
            }
          }

          if (hasProfileChanges) {
            saveState('profiles', this.profiles);
          }
        }

        notifyListeners();
      } catch (err) {
        console.warn('Error syncing app settings:', err);
      }
    });
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

  async updateUserProfile(updates: Partial<Profile>) {
    if (!this.currentUser) return;
    
    this.currentUser = {
      ...this.currentUser,
      ...updates
    };

    // Update in all local profiles
    this.profiles = this.profiles.map(p => p.id === this.currentUser.id ? { ...p, ...updates } : p);

    // Update in chat messages so avatar reflects immediately everywhere
    this.messages = this.messages.map(m => {
      if (m.sender_id === this.currentUser.id) {
        return {
          ...m,
          sender: { ...(m.sender || this.currentUser), ...updates }
        };
      }
      return m;
    });

    saveState('currentUser', this.currentUser);
    saveState('profiles', this.profiles);
    saveState('messages', this.messages);
    notifyListeners();

    await updateProfileInSupabase(this.currentUser.id, updates);
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

    // Load user-specific message reads
    this.messageReads = loadInitialState<Record<string, string>>(`messageReads_${user.id}`, {});
    notifyListeners();

    this.syncMessageReads();
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
    this.messageReads = {};
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
  async addMessage(
    category: ChatCategory, 
    content: string, 
    media_url?: string, 
    reply_to_id?: string,
    recipient_id?: string
  ) {
    if (!this.currentUser) return;
    const replyMsg = reply_to_id ? this.messages.find(m => m.id === reply_to_id) : undefined;
    const senderProfile = this.currentUser;
    const recipientProfile = recipient_id ? this.profiles.find(p => p.id === recipient_id) : undefined;
    const groupId = this.group?.id || 'main-group';
    const tempId = `msg-${Date.now()}`;

    const newMsg: ChatMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: this.currentUser.id,
      recipient_id: recipient_id || null,
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
      recipient: recipientProfile
    };

    this.messages = [...this.messages, newMsg];
    saveState('messages', this.messages);

    // Update active category or DM read pointer for current user immediately
    const nowIso = new Date().toISOString();
    const readKey = recipient_id ? `dm_${recipient_id}` : (category || 'general');
    this.messageReads = {
      ...this.messageReads,
      [readKey]: nowIso
    };
    saveState(`messageReads_${this.currentUser.id}`, this.messageReads);
    notifyListeners();

    const remoteMsg = await sendMessageToSupabase({
      group_id: groupId,
      sender_id: this.currentUser.id,
      recipient_id,
      category,
      content,
      media_url,
      reply_to_id
    });

    if (remoteMsg) {
      this.messages = this.messages.map(m => m.id === tempId ? { 
        ...remoteMsg, 
        sender: senderProfile,
        recipient: recipientProfile,
        recipient_id: recipient_id || remoteMsg.recipient_id 
      } : m);
      saveState('messages', this.messages);
      notifyListeners();
    }

    return newMsg;
  },

  getClearedChatTime(chatKey: string): number {
    if (!this.currentUser) return 0;
    const userCleared = this.clearedChats || {};
    const localCleared = loadInitialState<Record<string, string>>(`clearedChats_${this.currentUser.id}`, {});
    const timestampStr = userCleared[chatKey] || localCleared[chatKey];
    if (!timestampStr) return 0;
    return new Date(timestampStr).getTime();
  },

  async clearGroupChat() {
    if (!this.currentUser) return;
    const nowIso = new Date().toISOString();
    const myId = this.currentUser.id;

    // Update clearedChats map
    this.clearedChats = {
      ...this.clearedChats,
      group: nowIso
    };
    saveState(`clearedChats_${myId}`, this.clearedChats);

    // Filter local memory
    const clearCutoff = new Date(nowIso).getTime();
    this.messages = this.messages.filter(m => {
      const isGroup = !m.recipient_id && m.category !== 'direct' && !m.category?.startsWith('dm_');
      if (isGroup) {
        return new Date(m.created_at).getTime() > clearCutoff;
      }
      return true;
    });

    saveState('messages', this.messages);
    notifyListeners();

    await clearMessagesFromSupabase({ isGroup: true, userId: myId });
  },

  async clearPrivateChat(friendId: string) {
    if (!this.currentUser || !friendId) return;
    const nowIso = new Date().toISOString();
    const myId = this.currentUser.id;

    // Update clearedChats map
    const chatKey = `dm_${friendId}`;
    this.clearedChats = {
      ...this.clearedChats,
      [chatKey]: nowIso
    };
    saveState(`clearedChats_${myId}`, this.clearedChats);

    // Filter local memory
    const clearCutoff = new Date(nowIso).getTime();
    this.messages = this.messages.filter(m => {
      const isDirectChat = 
        (m.sender_id === myId && m.recipient_id === friendId) ||
        (m.sender_id === friendId && m.recipient_id === myId) ||
        (m.category === `dm_${friendId}` && (m.sender_id === myId || m.sender_id === friendId)) ||
        (m.category === `dm_${myId}` && (m.sender_id === myId || m.sender_id === friendId));

      if (isDirectChat) {
        return new Date(m.created_at).getTime() > clearCutoff;
      }
      return true;
    });

    saveState('messages', this.messages);
    notifyListeners();

    await clearMessagesFromSupabase({ userId: myId, friendId });
  },

  getGroupMessages(): ChatMessage[] {
    if (!this.currentUser) return [];
    const clearTime = this.getClearedChatTime('group');

    return this.messages.filter(m => {
      const isGroup = !m.recipient_id && m.category !== 'direct' && !m.category?.startsWith('dm_');
      if (!isGroup) return false;
      if (clearTime && new Date(m.created_at).getTime() <= clearTime) return false;
      return true;
    });
  },

  getPrivateMessages(friendId: string): ChatMessage[] {
    if (!this.currentUser || !friendId) return [];
    const myId = this.currentUser.id;
    const clearTime = this.getClearedChatTime(`dm_${friendId}`);

    return this.messages.filter(m => {
      const isBetweenUs = 
        (m.sender_id === myId && m.recipient_id === friendId) ||
        (m.sender_id === friendId && m.recipient_id === myId) ||
        (m.category === `dm_${friendId}` && (m.sender_id === myId || m.sender_id === friendId)) ||
        (m.category === `dm_${myId}` && (m.sender_id === myId || m.sender_id === friendId));

      if (!isBetweenUs) return false;
      if (clearTime && new Date(m.created_at).getTime() <= clearTime) return false;
      return true;
    });
  },

  getDirectUnreadCount(friendId: string): number {
    if (!this.currentUser || !friendId) return 0;
    const myId = this.currentUser.id;
    const lastRead = this.messageReads[`dm_${friendId}`] || '1970-01-01T00:00:00.000Z';
    const lastReadTime = new Date(lastRead).getTime();
    const clearTime = this.getClearedChatTime(`dm_${friendId}`);
    const effectiveCutoff = Math.max(lastReadTime, clearTime);

    return this.messages.filter(m => {
      const isFromFriendToMe = 
        m.sender_id === friendId && 
        (m.recipient_id === myId || m.category === 'direct' || m.category === `dm_${myId}`);
      return isFromFriendToMe && new Date(m.created_at).getTime() > effectiveCutoff;
    }).length;
  },

  getGroupUnreadCount(): number {
    if (!this.currentUser) return 0;
    const myId = this.currentUser.id;
    const lastRead = this.messageReads['general'] || '1970-01-01T00:00:00.000Z';
    const lastReadTime = new Date(lastRead).getTime();
    const clearTime = this.getClearedChatTime('group');
    const effectiveCutoff = Math.max(lastReadTime, clearTime);

    return this.messages.filter(m => {
      const isGroup = !m.recipient_id && m.category !== 'direct' && !m.category?.startsWith('dm_');
      return isGroup && m.sender_id !== myId && new Date(m.created_at).getTime() > effectiveCutoff;
    }).length;
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

  async markCategoryAsRead(category: ChatCategory) {
    if (!this.currentUser) return;
    const currentUnread = category === 'general' ? this.getGroupUnreadCount() : this.getUnreadMessageCount(category);
    if (currentUnread === 0 && this.messageReads[category]) {
      return;
    }

    const now = new Date().toISOString();
    this.messageReads = {
      ...this.messageReads,
      [category]: now
    };
    saveState(`messageReads_${this.currentUser.id}`, this.messageReads);
    notifyListeners();

    await markCategoryAsReadInSupabase(this.currentUser.id, category);
  },

  async markDirectMessagesAsRead(friendId: string) {
    if (!this.currentUser || !friendId) return;
    const currentUnread = this.getDirectUnreadCount(friendId);
    if (currentUnread === 0 && this.messageReads[`dm_${friendId}`]) {
      return;
    }

    const now = new Date().toISOString();
    this.messageReads = {
      ...this.messageReads,
      [`dm_${friendId}`]: now
    };
    saveState(`messageReads_${this.currentUser.id}`, this.messageReads);
    notifyListeners();
  },

  async markAllMessagesAsRead() {
    if (!this.currentUser) return;
    const now = new Date().toISOString();
    const categories: ChatCategory[] = ['general', 'college', 'plans', 'memories', 'random', 'direct'];
    const updated: Record<string, string> = { ...this.messageReads };
    for (const cat of categories) {
      updated[cat] = now;
    }
    // Also mark all friend direct chats as read
    this.profiles.forEach(p => {
      updated[`dm_${p.id}`] = now;
    });
    this.messageReads = updated;
    saveState(`messageReads_${this.currentUser.id}`, this.messageReads);
    notifyListeners();

    await markAllCategoriesAsReadInSupabase(this.currentUser.id);
  },

  getUnreadMessageCount(category?: ChatCategory): number {
    if (!this.currentUser) return 0;
    const myId = this.currentUser.id;

    if (category) {
      const lastRead = this.messageReads[category] || '1970-01-01T00:00:00.000Z';
      const lastReadTime = new Date(lastRead).getTime();
      return this.messages.filter(
        m => (m.category === category || (!m.category && category === 'general')) &&
             m.sender_id !== myId &&
             new Date(m.created_at).getTime() > lastReadTime
      ).length;
    }

    // Total unread: group + all direct messages
    const groupUnread = this.getGroupUnreadCount();
    let dmUnread = 0;
    this.profiles.forEach(p => {
      if (p.id !== myId) {
        dmUnread += this.getDirectUnreadCount(p.id);
      }
    });

    return groupUnread + dmUnread;
  },

  // Expenses & Loans Actions
  async addGroupExpense(
    title: string, 
    total_amount: number, 
    category: string, 
    participant_ids: string[],
    customShares?: Record<string, number>
  ) {
    if (!this.currentUser) return;
    const defaultShare = Number((total_amount / (participant_ids.length || 1)).toFixed(2));
    const groupId = this.group?.id || 'main-group';
    const tempId = `exp-${Date.now()}`;

    const participants = participant_ids.map(uid => {
      const share = (customShares && customShares[uid] !== undefined) 
        ? Number(customShares[uid]) 
        : defaultShare;
      return {
        user_id: uid,
        share_amount: share,
        status: (uid === this.currentUser.id ? 'settled' : 'pending') as 'settled' | 'pending',
        settled_at: uid === this.currentUser.id ? new Date().toISOString() : undefined
      };
    });

    const newExpense: GroupExpense = {
      id: tempId,
      group_id: groupId,
      paid_by: this.currentUser.id,
      title,
      total_amount,
      category,
      participants,
      created_at: new Date().toISOString(),
      payer_profile: this.currentUser,
    };

    this.expenses = [newExpense, ...this.expenses.filter(e => e.id !== tempId)];
    saveState('expenses', this.expenses);
    notifyListeners();

    // Send notifications to other participants
    participants.forEach(p => {
      if (p.user_id !== this.currentUser?.id) {
        this.addNotification(
          p.user_id,
          'expense',
          '💰 New Shared Expense',
          `${this.currentUser?.full_name} added "${title}". Your share is ₹${p.share_amount}.`
        );
      }
    });

    const remoteExp = await addExpenseToSupabase({
      group_id: groupId,
      paid_by: this.currentUser.id,
      title,
      total_amount,
      category,
      participants
    });

    if (remoteExp) {
      this.expenses = this.expenses.map(e => e.id === tempId ? { ...remoteExp, payer_profile: this.currentUser } : e);
      saveState('expenses', this.expenses);
      notifyListeners();
      return remoteExp;
    } else if (isSupabaseConfigured) {
      // Rollback temporary optimistic state if Supabase insertion failed
      this.expenses = this.expenses.filter(e => e.id !== tempId);
      saveState('expenses', this.expenses);
      notifyListeners();
      throw new Error('Unable to create split. Please try again.');
    }
    return newExpense;
  },

  async updateGroupExpense(
    expenseId: string,
    updates: {
      title?: string;
      category?: string;
      total_amount?: number;
      participants?: ExpenseParticipant[];
    }
  ) {
    const existing = this.expenses.find(e => e.id === expenseId);
    if (!existing) return;

    const updatedExpense: GroupExpense = {
      ...existing,
      title: updates.title !== undefined ? updates.title : existing.title,
      category: updates.category !== undefined ? updates.category : existing.category,
      total_amount: updates.total_amount !== undefined ? updates.total_amount : existing.total_amount,
      participants: updates.participants !== undefined ? updates.participants : existing.participants,
    };

    this.expenses = this.expenses.map(e => e.id === expenseId ? updatedExpense : e);
    saveState('expenses', this.expenses);
    notifyListeners();

    if (this.currentUser && updates.participants) {
      updates.participants.forEach(p => {
        if (p.user_id !== this.currentUser?.id) {
          this.addNotification(
            p.user_id,
            'expense',
            '✏️ Expense Split Updated',
            `${this.currentUser?.full_name} updated split for "${updatedExpense.title}". Your share is ₹${p.share_amount}.`
          );
        }
      });
    }

    const remoteExp = await updateExpenseInSupabase(expenseId, updates);
    if (remoteExp) {
      this.expenses = this.expenses.map(e => e.id === expenseId ? { ...remoteExp, payer_profile: existing.payer_profile || this.currentUser } : e);
      saveState('expenses', this.expenses);
      notifyListeners();
    }
  },

  async deleteExpense(expenseId: string) {
    const existing = this.expenses.find(e => e.id === expenseId);
    this.expenses = this.expenses.filter(e => e.id !== expenseId);
    saveState('expenses', this.expenses);
    notifyListeners();

    if (existing && this.currentUser) {
      existing.participants.forEach(p => {
        if (p.user_id !== this.currentUser?.id) {
          this.addNotification(
            p.user_id,
            'expense',
            '🗑️ Expense Removed',
            `${this.currentUser?.full_name} removed the expense "${existing.title}".`
          );
        }
      });
    }

    await deleteExpenseFromSupabase(expenseId);
  },

  async deletePersonalLoan(loanId: string) {
    this.loans = this.loans.filter(l => l.id !== loanId);
    saveState('loans', this.loans);
    notifyListeners();

    await deleteLoanFromSupabase(loanId);
  },

  async updatePersonalLoan(
    loanId: string,
    updates: {
      amount?: number;
      reason?: string;
      category?: string;
      borrower_id?: string;
      lender_id?: string;
    }
  ) {
    const existing = this.loans.find(l => l.id === loanId);
    if (!existing) return;

    const updatedLoan: PersonalLoan = {
      ...existing,
      amount: updates.amount !== undefined ? updates.amount : existing.amount,
      reason: updates.reason !== undefined ? updates.reason : existing.reason,
      category: updates.category !== undefined ? updates.category : existing.category,
      borrower_id: updates.borrower_id !== undefined ? updates.borrower_id : existing.borrower_id,
      lender_id: updates.lender_id !== undefined ? updates.lender_id : existing.lender_id,
    };

    const lender = this.profiles.find(p => p.id === updatedLoan.lender_id) || existing.lender_profile;
    const borrower = this.profiles.find(p => p.id === updatedLoan.borrower_id) || existing.borrower_profile;
    updatedLoan.lender_profile = lender;
    updatedLoan.borrower_profile = borrower;

    this.loans = this.loans.map(l => l.id === loanId ? updatedLoan : l);
    saveState('loans', this.loans);
    notifyListeners();

    if (this.currentUser) {
      const otherUserId = updatedLoan.lender_id === this.currentUser.id ? updatedLoan.borrower_id : updatedLoan.lender_id;
      this.addNotification(
        otherUserId,
        'expense',
        '✏️ Debt Updated',
        `${this.currentUser.full_name} updated the transaction to ₹${updatedLoan.amount} for "${updatedLoan.reason}".`
      );
    }

    const remoteLoan = await updateLoanInSupabase(loanId, updates);
    if (remoteLoan) {
      this.loans = this.loans.map(l => l.id === loanId ? { ...remoteLoan, lender_profile: lender, borrower_profile: borrower } : l);
      saveState('loans', this.loans);
      notifyListeners();
    }
  },

  async addPersonalLoan(
    borrower_id: string, 
    amount: number, 
    reason: string, 
    category: PersonalLoan['category'],
    customLenderId?: string
  ) {
    if (!this.currentUser) return;
    const tempId = `loan-${Date.now()}`;
    const lenderId = customLenderId || this.currentUser.id;
    const actualBorrowerId = borrower_id;

    const lender = this.profiles.find(p => p.id === lenderId) || (lenderId === this.currentUser.id ? this.currentUser : undefined);
    const borrower = this.profiles.find(p => p.id === actualBorrowerId) || (actualBorrowerId === this.currentUser.id ? this.currentUser : undefined);

    const newLoan: PersonalLoan = {
      id: tempId,
      lender_id: lenderId,
      borrower_id: actualBorrowerId,
      amount,
      reason,
      category,
      status: 'pending',
      created_at: new Date().toISOString(),
      lender_profile: lender,
      borrower_profile: borrower,
    };

    this.loans = [newLoan, ...this.loans];
    saveState('loans', this.loans);
    notifyListeners();

    // Send notifications to the other party
    const isCurrentUserLender = this.currentUser.id === lenderId;
    if (isCurrentUserLender) {
      this.addNotification(
        actualBorrowerId,
        'expense',
        '🤝 New Debt Added',
        `${this.currentUser.full_name} recorded that you owe ₹${amount} for "${reason}".`
      );
    } else {
      this.addNotification(
        lenderId,
        'expense',
        '🤝 New Debt Recorded',
        `${this.currentUser.full_name} recorded that they owe you ₹${amount} for "${reason}".`
      );
    }

    const remoteLoan = await addLoanToSupabase({
      lender_id: lenderId,
      borrower_id: actualBorrowerId,
      amount,
      reason,
      category
    });

    if (remoteLoan) {
      this.loans = this.loans.map(l => l.id === tempId ? { ...remoteLoan, lender_profile: lender, borrower_profile: borrower } : l);
      saveState('loans', this.loans);
      notifyListeners();
    }
  },

  async claimLoanPayment(loanId: string) {
    const targetLoan = this.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    this.loans = this.loans.map(loan => {
      if (loan.id === loanId) {
        return {
          ...loan,
          status: 'payment_claimed',
          claimed_at: new Date().toISOString()
        };
      }
      return loan;
    });

    saveState('loans', this.loans);
    notifyListeners();

    await claimLoanPaymentInSupabase(loanId);

    // Notify lender to confirm
    if (this.currentUser && targetLoan.lender_id !== this.currentUser.id) {
      this.addNotification(
        targetLoan.lender_id,
        'payment',
        '💰 Payment Confirmation Requested',
        `${this.currentUser.full_name} claims they paid ₹${targetLoan.amount} for "${targetLoan.reason}". Please confirm receipt.`
      );
    }
  },

  async confirmLoanPayment(loanId: string) {
    const targetLoan = this.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

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

    await confirmLoanPaymentInSupabase(loanId);

    // Notify borrower that payment was confirmed
    if (this.currentUser) {
      this.addNotification(
        targetLoan.borrower_id,
        'payment',
        '✅ Payment Confirmed',
        `${this.currentUser.full_name} confirmed your payment of ₹${targetLoan.amount} for "${targetLoan.reason}".`
      );
    }
  },

  async rejectLoanPaymentClaim(loanId: string) {
    const targetLoan = this.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    this.loans = this.loans.map(loan => {
      if (loan.id === loanId) {
        return {
          ...loan,
          status: 'pending',
          claimed_at: null
        };
      }
      return loan;
    });

    saveState('loans', this.loans);
    notifyListeners();

    await rejectLoanPaymentClaimInSupabase(loanId);

    // Notify borrower that payment was rejected
    if (this.currentUser) {
      this.addNotification(
        targetLoan.borrower_id,
        'payment',
        '❌ Payment Claim Rejected',
        `${this.currentUser.full_name} indicated they did not receive your payment of ₹${targetLoan.amount} for "${targetLoan.reason}".`
      );
    }
  },

  async markLoanAsPaid(loanId: string) {
    // Backward compatibility for lender direct mark paid
    return this.confirmLoanPayment(loanId);
  },

  async claimExpenseShare(expenseId: string, userId?: string) {
    const targetUserId = userId || this.currentUser?.id;
    if (!targetUserId) return;

    const targetExpense = this.expenses.find(e => e.id === expenseId);
    const participant = targetExpense?.participants.find(p => p.user_id === targetUserId);
    const shareAmount = participant?.share_amount || 0;

    this.expenses = this.expenses.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        participants: exp.participants.map(p => 
          p.user_id === targetUserId 
            ? { ...p, status: 'payment_claimed', claimed_at: new Date().toISOString() } 
            : p
        )
      };
    });

    saveState('expenses', this.expenses);
    notifyListeners();

    await claimExpenseShareInSupabase(expenseId, targetUserId);

    if (targetExpense && this.currentUser && targetExpense.paid_by !== targetUserId) {
      this.addNotification(
        targetExpense.paid_by,
        'payment',
        '💰 Split Share Claimed',
        `${this.currentUser.full_name} claims they paid their ₹${shareAmount} share for "${targetExpense.title}". Please confirm.`
      );
    }
  },

  async confirmExpenseShare(expenseId: string, userId: string) {
    const targetExpense = this.expenses.find(e => e.id === expenseId);
    const participant = targetExpense?.participants.find(p => p.user_id === userId);
    const shareAmount = participant?.share_amount || 0;

    this.expenses = this.expenses.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        participants: exp.participants.map(p => 
          p.user_id === userId 
            ? { ...p, status: 'settled', settled_at: new Date().toISOString() } 
            : p
        )
      };
    });

    saveState('expenses', this.expenses);
    notifyListeners();

    await settleExpenseShareInSupabase(expenseId, userId);

    if (targetExpense && this.currentUser) {
      this.addNotification(
        userId,
        'payment',
        '✅ Expense Share Confirmed',
        `${this.currentUser.full_name} confirmed your ₹${shareAmount} payment for "${targetExpense.title}".`
      );
    }
  },

  async rejectExpenseShareClaim(expenseId: string, userId: string) {
    const targetExpense = this.expenses.find(e => e.id === expenseId);
    const participant = targetExpense?.participants.find(p => p.user_id === userId);
    const shareAmount = participant?.share_amount || 0;

    this.expenses = this.expenses.map(exp => {
      if (exp.id !== expenseId) return exp;
      return {
        ...exp,
        participants: exp.participants.map(p => 
          p.user_id === userId 
            ? { ...p, status: 'pending', claimed_at: null } 
            : p
        )
      };
    });

    saveState('expenses', this.expenses);
    notifyListeners();

    await rejectExpenseShareClaimInSupabase(expenseId, userId);

    if (targetExpense && this.currentUser) {
      this.addNotification(
        userId,
        'payment',
        '❌ Split Share Not Confirmed',
        `${this.currentUser.full_name} indicated they did not receive your ₹${shareAmount} payment for "${targetExpense.title}".`
      );
    }
  },

  async settleExpenseShare(expenseId: string, userId: string) {
    return this.confirmExpenseShare(expenseId, userId);
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

  async deletePlan(planId: string): Promise<boolean> {
    if (!this.currentUser) return false;
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) return false;

    // Check authorization: creator or admin
    const isCreator = plan.creator_id === this.currentUser.id;
    const isAdmin = isUserAdmin(this.currentUser);
    if (!isCreator && !isAdmin) {
      console.warn('Unauthorized to delete this plan');
      return false;
    }

    // Optimistic removal from store
    this.plans = this.plans.filter(p => p.id !== planId);
    saveState('plans', this.plans);
    notifyListeners();

    const success = await deletePlanFromSupabase(planId, this.currentUser.id);
    return success;
  },

  // Memories
  async addMemory(
    title: string, 
    caption: string, 
    media_urls: string[], 
    date: string, 
    location?: string, 
    tagged_user_ids: string[] = [],
    youtube_url?: string | null,
    youtube_video_id?: string | null
  ): Promise<{ success: boolean; memory?: Memory; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'User not logged in' };
    const groupId = this.group?.id;
    const tempId = `mem-${Date.now()}`;

    const cleanYtUrl = youtube_url?.trim() || null;
    const cleanYtId = youtube_video_id?.trim() || (cleanYtUrl ? extractYouTubeVideoId(cleanYtUrl) : null);

    const newMem: Memory = {
      id: tempId,
      group_id: groupId,
      creator_id: this.currentUser.id,
      title,
      caption,
      media_urls: media_urls || [],
      youtube_url: cleanYtUrl,
      youtube_video_id: cleanYtId,
      date,
      location,
      tagged_user_ids,
      created_at: new Date().toISOString(),
      creator_profile: this.currentUser,
    };

    if (isSupabaseConfigured) {
      const remoteMem = await addMemoryToSupabase({
        group_id: groupId,
        creator_id: this.currentUser.id,
        title,
        caption,
        media_urls,
        youtube_url: cleanYtUrl,
        youtube_video_id: cleanYtId,
        date,
        location,
        tagged_user_ids
      });

      if (remoteMem) {
        const fullMem: Memory = { 
          ...remoteMem, 
          youtube_url: cleanYtUrl || remoteMem.youtube_url,
          youtube_video_id: cleanYtId || remoteMem.youtube_video_id,
          creator_profile: this.currentUser 
        };
        this.memories = [fullMem, ...this.memories.filter(m => m.id !== tempId)];
        saveState('memories', this.memories);
        notifyListeners();

        const hasVideo = Boolean(cleanYtId || cleanYtUrl);
        const icon = hasVideo && (media_urls?.length > 0) ? '📸🎥' : hasVideo ? '🎥' : '📸';
        this.addMessage('memories', `${icon} Shared new group memory: "${title}" (${date})!`);

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

        return { success: true, memory: fullMem };
      } else {
        return { success: false, error: 'Failed to persist memory to Supabase database.' };
      }
    } else {
      // Local fallback mode
      this.memories = [newMem, ...this.memories];
      saveState('memories', this.memories);
      notifyListeners();
      
      const hasVideo = Boolean(cleanYtId || cleanYtUrl);
      const icon = hasVideo && (media_urls?.length > 0) ? '📸🎥' : hasVideo ? '🎥' : '📸';
      this.addMessage('memories', `${icon} Shared new group memory: "${title}" (${date})!`);

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

      return { success: true, memory: newMem };
    }
  },

  async updateMemory(
    memoryId: string,
    updates: {
      title?: string;
      caption?: string;
      date?: string;
      location?: string;
      tagged_user_ids?: string[];
      youtube_url?: string | null;
      youtube_video_id?: string | null;
    }
  ): Promise<boolean> {
    if (!this.currentUser) return false;
    const target = this.memories.find(m => m.id === memoryId);
    if (!target) return false;

    const isAdmin = isUserAdmin(this.currentUser);
    const isCreator = target.creator_id === this.currentUser.id || 
                      target.creator_profile?.id === this.currentUser.id ||
                      target.creator_profile?.email?.toLowerCase() === this.currentUser.email?.toLowerCase();

    if (!isCreator && !isAdmin) {
      console.warn('Unauthorized to update this memory.');
      return false;
    }

    const cleanYtUrl = updates.youtube_url !== undefined ? (updates.youtube_url?.trim() || null) : target.youtube_url;
    const cleanYtId = updates.youtube_video_id !== undefined ? (updates.youtube_video_id?.trim() || null) : (cleanYtUrl ? extractYouTubeVideoId(cleanYtUrl) : null);

    const updatedMemory: Memory = {
      ...target,
      ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
      ...(updates.caption !== undefined ? { caption: (updates.caption || '').trim() } : {}),
      ...(updates.date !== undefined ? { date: updates.date } : {}),
      ...(updates.location !== undefined ? { location: (updates.location || '').trim() } : {}),
      ...(updates.tagged_user_ids !== undefined ? { tagged_user_ids: updates.tagged_user_ids } : {}),
      youtube_url: cleanYtUrl,
      youtube_video_id: cleanYtId,
    };

    this.memories = this.memories.map(m => m.id === memoryId ? updatedMemory : m);
    saveState('memories', this.memories);
    notifyListeners();

    if (isSupabaseConfigured) {
      await updateMemoryInSupabase(memoryId, {
        ...updates,
        youtube_url: cleanYtUrl,
        youtube_video_id: cleanYtId
      });
    }
    return true;
  },

  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.currentUser) return false;
    const target = this.memories.find(m => m.id === memoryId);
    
    // Check permissions if memory exists in local state
    if (target) {
      const isAdmin = isUserAdmin(this.currentUser);
      const isCreator = target.creator_id === this.currentUser.id || 
                        target.creator_profile?.id === this.currentUser.id ||
                        target.creator_profile?.email?.toLowerCase() === this.currentUser.email?.toLowerCase();

      if (!isCreator && !isAdmin) {
        console.warn('Unauthorized to delete this memory.');
        return false;
      }
    }

    // Immediately remove from store state and notify UI
    this.memories = this.memories.filter(m => m.id !== memoryId);
    saveState('memories', this.memories);
    notifyListeners();

    if (isSupabaseConfigured) {
      try {
        await deleteMemoryFromSupabase(memoryId);
      } catch (err) {
        console.warn('Error deleting memory from Supabase:', err);
      }
    }
    return true;
  },

  // ----------------------------------------------------
  // NOTES FEATURE (Shared Multi-Image & PDF Group Notes)
  // ----------------------------------------------------
  async addNote(params: {
    caption: string;
    files: { file: File; type: 'image' | 'pdf' }[];
    isPasswordProtected: boolean;
    password?: string;
  }): Promise<{ success: boolean; note?: Note; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'User not authenticated' };

    const res = await createNoteInSupabase({
      ...params,
      uploaderId: this.currentUser.id
    });

    if (res.success && res.note) {
      const fullNote: Note = {
        ...res.note,
        uploader_profile: this.currentUser
      };
      this.notes = [fullNote, ...this.notes.filter(n => n.id !== fullNote.id)];
      saveState('notes', this.notes);
      
      // Auto unlock in current session for the uploader
      this.unlockedNoteIds.add(fullNote.id);
      notifyListeners();
      return { success: true, note: fullNote };
    }

    return res;
  },

  async deleteNote(noteId: string): Promise<boolean> {
    if (!this.currentUser) return false;
    const target = this.notes.find(n => n.id === noteId);

    if (target) {
      const isAdmin = isUserAdmin(this.currentUser);
      const isUploader = target.uploaded_by === this.currentUser.id ||
                        target.uploader_profile?.id === this.currentUser.id ||
                        target.uploader_profile?.email?.toLowerCase() === this.currentUser.email?.toLowerCase();

      if (!isUploader && !isAdmin) {
        console.warn('Unauthorized to delete this note.');
        return false;
      }
    }

    this.notes = this.notes.filter(n => n.id !== noteId);
    this.unlockedNoteIds.delete(noteId);
    saveState('notes', this.notes);
    notifyListeners();

    if (isSupabaseConfigured) {
      try {
        await deleteNoteFromSupabase(noteId);
      } catch (err) {
        console.warn('Error deleting note from Supabase:', err);
      }
    }
    return true;
  },

  async verifyAndUnlockNote(noteId: string, passwordAttempt: string): Promise<boolean> {
    if (!this.currentUser) return false;
    const target = this.notes.find(n => n.id === noteId);
    if (!target) return false;

    // Unprotected notes are open by default
    if (!target.is_password_protected) {
      this.unlockedNoteIds.add(noteId);
      notifyListeners();
      return true;
    }

    // Admin has Master Access: opens directly without knowing user password
    if (isUserAdmin(this.currentUser)) {
      this.unlockedNoteIds.add(noteId);
      notifyListeners();
      return true;
    }

    // Regular users: verify hash against stored hash in Supabase
    const isMatch = await verifyNotePasswordInSupabase(noteId, passwordAttempt);
    if (isMatch) {
      this.unlockedNoteIds.add(noteId);
      notifyListeners();
      return true;
    }

    return false;
  },

  isNoteUnlocked(noteId: string): boolean {
    const target = this.notes.find(n => n.id === noteId);
    if (!target) return false;
    if (!target.is_password_protected) return true;
    if (isUserAdmin(this.currentUser)) return true;
    return this.unlockedNoteIds.has(noteId);
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

    await apiAdminToggleMemoriesLock(this.currentUser, isLocked);
    return true;
  },

  async adminToggleMemoriesLock(isLocked: boolean): Promise<boolean> {
    return this.toggleMemoriesLock(isLocked);
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

    await apiAdminChangeMemoriesPasscode(this.currentUser, cleanPasscode);
    return true;
  },

  async adminChangeMemoriesPassword(newPasscode: string): Promise<boolean> {
    return this.changeMemoriesPasscode(newPasscode);
  },

  async unlockMemoriesWithPasscode(inputPasscode: string): Promise<boolean> {
    const cleanPasscode = inputPasscode.trim();
    if (!cleanPasscode) return false;

    const isMatch = await verifyMemoriesPasscodeSecurely(cleanPasscode);
    if (isMatch) {
      this.sessionUnlockedMemories = true;
      notifyListeners();
      return true;
    }
    return false;
  },

  // Admin User Ban / Unban
  async adminBanUser(targetUserId: string, reason?: string): Promise<boolean> {
    if (!isUserAdmin(this.currentUser)) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const targetUser = this.profiles.find(p => p.id === targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    const success = await adminSetUserBanStatus(this.currentUser, targetUser, true, reason);
    if (success) {
      this.profiles = this.profiles.map(p => 
        p.id === targetUserId ? { ...p, is_banned: true, status: 'banned' } : p
      );
      if (this.currentUser.id === targetUserId) {
        this.currentUser = { ...this.currentUser, is_banned: true, status: 'banned' };
        saveState('currentUser', this.currentUser);
      }
      saveState('profiles', this.profiles);
      notifyListeners();
    }
    return success;
  },

  async adminUnbanUser(targetUserId: string): Promise<boolean> {
    if (!isUserAdmin(this.currentUser)) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const targetUser = this.profiles.find(p => p.id === targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    const success = await adminSetUserBanStatus(this.currentUser, targetUser, false);
    if (success) {
      this.profiles = this.profiles.map(p => 
        p.id === targetUserId ? { ...p, is_banned: false, status: 'available' } : p
      );
      if (this.currentUser.id === targetUserId) {
        this.currentUser = { ...this.currentUser, is_banned: false, status: 'available' };
        saveState('currentUser', this.currentUser);
      }
      saveState('profiles', this.profiles);
      notifyListeners();
    }
    return success;
  },

  // Admin Update User Profile
  async adminUpdateUserProfile(targetUserId: string, updates: Partial<Profile>): Promise<boolean> {
    if (!isUserAdmin(this.currentUser)) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const targetUser = this.profiles.find(p => p.id === targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    const sanitizedUpdates = { ...updates };

    // Security check: Only Master Admin can change user roles
    if (sanitizedUpdates.role !== undefined) {
      const isCallerMasterAdmin = isMasterAdmin(this.currentUser);
      const isTargetMasterAdmin = isMasterAdmin(targetUser);

      if (!isCallerMasterAdmin) {
        // Non-master admins cannot modify roles at all
        delete sanitizedUpdates.role;
      } else if (isTargetMasterAdmin && sanitizedUpdates.role !== 'admin') {
        // Master admin cannot demote themselves from admin
        delete sanitizedUpdates.role;
      }
    }

    // 1. Update locally first for instant UI response
    this.profiles = this.profiles.map(p => 
      p.id === targetUserId ? { ...p, ...sanitizedUpdates } : p
    );
    if (this.currentUser && this.currentUser.id === targetUserId) {
      this.currentUser = { ...this.currentUser, ...sanitizedUpdates };
      saveState('currentUser', this.currentUser);
    }
    saveState('profiles', this.profiles);

    // Update messages sender references if full_name / avatar changed
    if (sanitizedUpdates.full_name || sanitizedUpdates.avatar_url || sanitizedUpdates.username) {
      this.messages = this.messages.map(m => {
        if (m.sender_id === targetUserId) {
          return {
            ...m,
            sender: {
              ...(m.sender || targetUser),
              ...sanitizedUpdates
            }
          };
        }
        return m;
      });
      saveState('messages', this.messages);
    }

    notifyListeners();

    // 2. Persist to Supabase app_settings (profile_overrides) for instant universal sync to ALL users
    await Promise.allSettled([
      updateProfileOverrideInSupabase(
        targetUserId, 
        targetUser.email, 
        sanitizedUpdates, 
        this.currentUser?.id
      ),
      updateProfileInSupabase(targetUserId, sanitizedUpdates)
    ]);

    return true;
  },

  // Admin Clear Completed Money History
  async adminClearCompletedMoneyHistory(targetUserId: string): Promise<{ success: boolean; clearedLoansCount: number; message: string }> {
    if (!isUserAdmin(this.currentUser)) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const targetUser = this.profiles.find(p => p.id === targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    const result = await apiAdminClearCompletedMoneyHistory(this.currentUser, targetUser);
    if (result.success) {
      // Remove paid/completed loans involving target user from store
      this.loans = this.loans.filter(l => {
        const isInvolved = l.lender_id === targetUserId || l.borrower_id === targetUserId;
        const isCompleted = l.status === 'paid';
        return !(isInvolved && isCompleted);
      });
      saveState('loans', this.loans);
      notifyListeners();
    }
    return result;
  },

  // Admin Initiate User Password Reset
  async adminInitiateUserPasswordReset(targetUserId: string): Promise<{ success: boolean; message: string }> {
    if (!isUserAdmin(this.currentUser)) {
      throw new Error('Unauthorized: Admin access required.');
    }
    const targetUser = this.profiles.find(p => p.id === targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }
    return apiAdminInitiateUserPasswordReset(this.currentUser, targetUser);
  },

  // Borrowed Tracker
  async addBorrowedItem(
    owner_id: string,
    borrower_id: string,
    item_name: string,
    expected_return_date: string,
    description?: string
  ) {
    const tempId = `bor-${Date.now()}`;
    const owner = this.profiles.find(p => p.id === owner_id);
    const borrower = this.profiles.find(p => p.id === borrower_id);
    const groupId = this.group?.id;

    const newItem: BorrowedItem = {
      id: tempId,
      owner_id,
      borrower_id,
      item_name,
      description: description || item_name,
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
      description,
      expected_return_date,
      group_id: groupId
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
  async sendSnap(
    recipientIdOrIds: string | string[], 
    storage_path: string, 
    caption?: string,
    viewDuration: number = 5,
    isEveryone: boolean = false
  ): Promise<SnapMessage | null> {
    if (!this.currentUser) {
      console.warn('[Snap Send] No active current user');
      return null;
    }

    let recipientIds: string[] = [];
    if (isEveryone) {
      // Dynamically query all eligible group members / profiles except the sender
      recipientIds = this.profiles
        .filter(p => p.id !== this.currentUser.id && !p.is_banned)
        .map(p => p.id);
    } else {
      recipientIds = Array.isArray(recipientIdOrIds)
        ? recipientIdOrIds.filter(id => id && id !== this.currentUser.id)
        : (recipientIdOrIds && recipientIdOrIds !== this.currentUser.id ? [recipientIdOrIds] : []);
    }

    if (recipientIds.length === 0) {
      console.warn('[Snap Send] No eligible recipients found for sender:', this.currentUser.id);
      return null;
    }

    const sendResult = await sendSnapToSupabase(
      this.currentUser.id, 
      recipientIds, 
      storage_path, 
      caption, 
      viewDuration, 
      isEveryone || recipientIds.length > 1
    );

    if (!sendResult.success || !sendResult.snap) {
      console.error('[Snap Send] Supabase delivery failed:', sendResult.error);
      return null;
    }

    const createdList = sendResult.snaps && sendResult.snaps.length > 0 ? sendResult.snaps : [sendResult.snap];
    const newSnaps: SnapMessage[] = createdList.map(s => ({
      ...s,
      sender_profile: this.currentUser,
    }));

    const createdIds = new Set(newSnaps.map(s => s.id));
    this.snaps = [...newSnaps, ...this.snaps.filter(s => !createdIds.has(s.id))];
    saveState('snaps', this.snaps);
    notifyListeners();

    // Add recipient notification for each recipient
    newSnaps.forEach(snapItem => {
      if (snapItem.recipient_id) {
        this.addNotification(
          snapItem.recipient_id, 
          'snap', 
          '📸 New Disappearing Snap', 
          `${this.currentUser?.full_name || 'A friend'} sent you a snap. Tap to view once.`,
          snapItem.id
        );
      }
    });

    return newSnaps[0];
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

    if (this.currentUser) {
      await openSnapInSupabase(snapId, this.currentUser.id);
    }

    if (targetSnap && this.currentUser && targetSnap.sender_id !== this.currentUser.id) {
      this.addNotification(
        targetSnap.sender_id,
        'snap',
        '📸 Snap Opened',
        `${this.currentUser.full_name} opened your snap.`,
        snapId
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

    if (this.currentUser) {
      await destroySnapInSupabase(snapId, this.currentUser.id);
    }
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
    const unsubscribe = appStore.subscribe(() => setVersion(v => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  return appStore;
}
