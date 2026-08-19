export type UserRole = 'admin' | 'member';

export type UserStatusPreset = 
  | '🟢 Available'
  | '🟡 Busy'
  | '🔴 Do Not Disturb'
  | '📚 Studying'
  | '😴 Sleeping'
  | '🏫 College'
  | '🏠 Home'
  | '🎮 Gaming'
  | '✈️ Travelling';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  birthday: string; // ISO date YYYY-MM-DD
  college: string;
  course_branch: string;
  semester: number;
  role: UserRole;
  status_emoji?: string;
  status_preset?: UserStatusPreset;
  status_text?: string;
  status_expires_at?: string | null;
  current_location?: string | null; // e.g. "College — Block A, Room A-203"
  payment_qr_url?: string | null;
  upi_id?: string | null;
  is_banned?: boolean;
  account_status?: 'active' | 'banned';
  created_at: string;
}

export interface FriendGroup {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  status: 'approved' | 'pending';
  role: UserRole;
  joined_at: string;
  profile?: Profile;
}

export type ChatCategory = 'general' | 'college' | 'plans' | 'memories' | 'random' | 'direct';

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  category: ChatCategory;
  recipient_id?: string | null;
  content: string;
  media_url?: string | null;
  reply_to_id?: string | null;
  reply_to_message?: {
    sender_name: string;
    content: string;
  } | null;
  reactions: Record<string, string[]>; // { "❤️": ["user1", "user2"], "🔥": ["user3"] }
  created_at: string;
  sender?: Profile;
  recipient?: Profile;
}

export interface ExpenseParticipant {
  user_id: string;
  share_amount: number;
  status: 'pending' | 'payment_claimed' | 'settled';
  claimed_at?: string | null;
  settled_at?: string | null;
}

export interface GroupExpense {
  id: string;
  group_id: string;
  paid_by: string;
  title: string;
  total_amount: number;
  category: string;
  participants: ExpenseParticipant[];
  created_at: string;
  payer_profile?: Profile;
}

export interface PersonalLoan {
  id: string;
  lender_id: string;
  borrower_id: string;
  amount: number;
  reason: string;
  category: 'Auto' | 'Bus' | 'Metro' | 'Food' | 'Cash' | 'Other' | string;
  status: 'pending' | 'payment_claimed' | 'paid';
  claimed_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  lender_profile?: Profile;
  borrower_profile?: Profile;
}

export interface GroupPlan {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  participants: {
    user_id: string;
    status: 'joined' | 'declined' | 'maybe';
  }[];
  polls?: PlanPoll[];
  created_at: string;
  creator_profile?: Profile;
}

export interface PlanPoll {
  id: string;
  plan_id: string;
  question: string;
  allow_multiple: boolean;
  options: {
    id: string;
    text: string;
    votes: string[]; // user_ids
  }[];
}

export interface MemoryPhoto {
  id?: string;
  memory_id?: string;
  storage_path: string;
  display_order: number;
  created_at?: string;
}

export interface Memory {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  caption: string;
  media_urls: string[];
  photos?: MemoryPhoto[];
  youtube_url?: string | null;
  youtube_video_id?: string | null;
  date: string;
  location?: string;
  tagged_user_ids: string[];
  created_at: string;
  creator_profile?: Profile;
}

export interface BorrowedItem {
  id: string;
  owner_id: string;
  borrower_id: string;
  item_name: string;
  description?: string;
  borrowed_date: string;
  expected_return_date: string;
  returned_at?: string | null;
  status: 'borrowed' | 'returned';
  created_at: string;
  owner_profile?: Profile;
  borrower_profile?: Profile;
}

export interface ImportantDate {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: 'birthday' | 'anniversary' | 'trip' | 'custom';
  user_id?: string | null; // associated user profile for birthdays
  created_at: string;
}

export interface TimetableSlot {
  id: string;
  college_id?: string; // 'GHRCE_SEM3_SECTION_A' | 'SKILLTECH_SEM3_SECTION_A'
  day_of_week: number; // 1 = Monday ... 6 = Saturday, 0 = Sunday
  start_time: string; // e.g. "12:10"
  end_time: string; // e.g. "01:05"
  subject_code: string; // e.g. "DSA", "DMGT", "OE-1"
  subject_name: string; // e.g. "Data Structure and Algorithm"
  is_academic?: boolean; // false for Library, Break, Activity, Guest Lecture
  room?: string;
  faculty?: string;
  timetable_id?: string;
}

export type TimetableEntry = TimetableSlot;

export interface Timetable {
  id: string;
  college_id: string; // 'GHRCE_SEM3_SECTION_A' | 'SKILLTECH_SEM3_SECTION_A'
  college_name: string;
  branch: string;
  semester: number;
  section: string;
  slots: TimetableSlot[];
  entries?: TimetableSlot[];
  created_by?: string;
  created_at?: string;
}

export interface DateAttendanceRecord {
  id: string;
  user_id: string;
  college_id: string;
  date: string; // YYYY-MM-DD
  slot_time: string; // "12:10–1:05"
  subject_code: string;
  subject_name: string;
  status: 'attended' | 'absent' | 'cancelled';
  reported_by?: string; // user_id who reported cancellation
  updated_at: string;
}

export type AttendanceRecord = DateAttendanceRecord;

export interface GroupCancellationReport {
  id: string;
  college_id: string;
  date: string; // YYYY-MM-DD
  slot_time: string;
  subject_code: string;
  subject_name: string;
  reported_by_user_id: string;
  reported_by_name: string;
  confirmed_by_user_ids: string[];
  created_at: string;
}

export interface SpecialCollegeDate {
  id: string;
  college_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'holiday' | 'exam' | 'no_classes' | 'special_event';
}

export interface SubjectAttendanceSummary {
  subject_code: string;
  subject_name: string;
  attended: number;
  absent: number;
  cancelled: number;
  conducted: number;
  percentage: number;
  can_miss: number; // For attendance calculator
  need_to_attend: number; // For attendance calculator
}

export interface Assignment {
  id: string;
  subject: string;
  title: string;
  due_date: string;
  is_completed: boolean;
}

export interface SnapRecipientInfo {
  recipient_id: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  expires_at?: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'expired';
  recipient_profile?: Profile;
}

export interface SnapMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  recipient_ids?: string[];
  recipients?: SnapRecipientInfo[];
  is_everyone?: boolean;
  image_url: string;
  caption?: string;
  view_duration?: number;
  sent_at: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  expires_at?: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'expired';
  sender_profile?: Profile;
  recipient_profile?: Profile;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'message' | 'mention' | 'snap' | 'expense' | 'loan' | 'plan' | 'birthday' | 'borrowed' | 'college';
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NoteFile {
  id: string;
  note_id: string;
  storage_path: string;
  file_name: string;
  file_type: 'image' | 'pdf';
  file_size?: number;
  display_order: number;
  created_at: string;
}

export interface Note {
  id: string;
  uploaded_by: string;
  caption: string;
  is_password_protected: boolean;
  password_hash?: string | null;
  created_at: string;
  updated_at?: string;
  files?: NoteFile[];
  uploader_profile?: Profile;
}

export type NavigationTab = 
  | 'home'
  | 'friends'
  | 'chat'
  | 'discussions'
  | 'snaps'
  | 'expenses'
  | 'plans'
  | 'memories'
  | 'notes'
  | 'borrowed'
  | 'dates'
  | 'college'
  | 'attendance'
  | 'notifications'
  | 'profile'
  | 'me'
  | 'admin';
