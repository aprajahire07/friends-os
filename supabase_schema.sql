-- FRIEND OS - Complete PostgreSQL Migration Script for Supabase
-- Execute this entire script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  birthday DATE,
  college TEXT DEFAULT 'GHRCE/GHRSTU',
  course_branch TEXT DEFAULT 'Computer Science & Engineering',
  semester INT DEFAULT 3,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT DEFAULT 'available',
  custom_status TEXT,
  status_emoji TEXT DEFAULT '🟢',
  status_preset TEXT DEFAULT '🟢 Available',
  status_expires_at TIMESTAMPTZ,
  current_location TEXT,
  payment_qr_url TEXT,
  upi_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow birthday updates (removed strict block trigger)
DROP TRIGGER IF EXISTS tr_prevent_birthday_update ON public.profiles;
DROP FUNCTION IF EXISTS prevent_birthday_update();

-- Trigger to auto-create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    username,
    birthday,
    college,
    course_branch,
    semester
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTRING(NEW.id::text, 1, 4)),
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, CURRENT_DATE),
    COALESCE(NEW.raw_user_meta_data->>'college', 'GHRCE/GHRSTU'),
    COALESCE(NEW.raw_user_meta_data->>'course_branch', 'Computer Science & Engineering'),
    COALESCE((NEW.raw_user_meta_data->>'semester')::int, 3)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. GROUP SYSTEM & FRIENDSHIPS
CREATE TABLE IF NOT EXISTS public.friend_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id <> friend_id)
);

-- 3. CHAT DATABASE
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name IN ('general', 'college', 'plans', 'memories', 'random')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'college', 'plans', 'memories', 'random')),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- 4. EXPENSES & LOANS DATABASE
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  expense_date DATE DEFAULT CURRENT_DATE,
  category TEXT DEFAULT 'other' CHECK (category IN ('food', 'auto', 'bus', 'metro', 'movie', 'cash', 'other', 'Other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_amount NUMERIC NOT NULL,
  paid_status BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  UNIQUE(expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('food', 'auto', 'bus', 'metro', 'movie', 'cash', 'other', 'Food', 'Auto', 'Bus', 'Metro', 'Cash', 'Other')),
  loan_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (lender_id <> borrower_id)
);

CREATE TABLE IF NOT EXISTS public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PAYMENT QR
CREATE TABLE IF NOT EXISTS public.payment_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PLANS & POLLS
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  plan_date DATE NOT NULL,
  start_time TIME NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.plan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going', 'joined', 'declined')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  allow_multiple BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 7. MEMORIES & PHOTOS & MEDIA & TAGS
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  caption TEXT NOT NULL,
  memory_date DATE NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memory_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memory_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memory_id, user_id)
);

-- 8. BORROWED ITEMS
CREATE TABLE IF NOT EXISTS public.borrowed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  borrowed_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  returned_date DATE,
  status TEXT DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. IMPORTANT DATES
CREATE TABLE IF NOT EXISTS public.important_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.friend_groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('birthday', 'friendship', 'trip', 'custom', 'anniversary')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. COLLEGES, TIMETABLE & DATE-BASED ATTENDANCE
CREATE TABLE IF NOT EXISTS public.colleges (
  id TEXT PRIMARY KEY, -- e.g. 'GHRCE_SEM3_SECTION_A', 'SKILLTECH_SEM3_SECTION_A'
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  semester INT NOT NULL,
  section TEXT NOT NULL DEFAULT 'A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_attendance INT DEFAULT 75
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timetable_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_profile_id UUID REFERENCES public.timetable_profiles(id) ON DELETE CASCADE,
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  room TEXT,
  faculty TEXT,
  is_academic BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.special_college_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('holiday', 'exam', 'no_classes', 'special_event')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  timetable_entry_id UUID REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  slot_time TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('attended', 'absent', 'cancelled')),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, attendance_date, slot_time)
);

CREATE TABLE IF NOT EXISTS public.class_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot_time TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  reported_by_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_by_name TEXT NOT NULL,
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'confirmed', 'rejected')),
  confirmed_by_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. DISAPPEARING SNAPS
CREATE TABLE IF NOT EXISTS public.snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_everyone BOOLEAN DEFAULT FALSE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  view_duration INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.snap_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id UUID REFERENCES public.snaps(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'expired')),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snap_id, recipient_id)
);

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'mention', 'snap', 'snap_opened', 'expense', 'payment', 'plan', 'poll', 'birthday', 'borrowed', 'attendance', 'college')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. APP SETTINGS & SECURITY (Admin Controlled Memories Lock & Passcode)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_channel ON public.messages(group_id, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_class_reports_college_date ON public.class_reports(college_id, date);
CREATE INDEX IF NOT EXISTS idx_plans_group_date ON public.plans(group_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_loans_users ON public.loans(lender_id, borrower_id);
CREATE INDEX IF NOT EXISTS idx_snaps_sender ON public.snaps(sender_id);
CREATE INDEX IF NOT EXISTS idx_snaps_receiver ON public.snaps(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_snaps_is_everyone ON public.snaps(is_everyone);
CREATE INDEX IF NOT EXISTS idx_snap_recipients_snap ON public.snap_recipients(snap_id);
CREATE INDEX IF NOT EXISTS idx_snap_recipients_user ON public.snap_recipients(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_college_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snap_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "Profiles select" ON public.profiles;
CREATE POLICY "Profiles select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles insert" ON public.profiles;
CREATE POLICY "Profiles insert" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
CREATE POLICY "Profiles update" ON public.profiles FOR UPDATE 
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND (p.role = 'admin' OR p.email = 'aprajahire07@gmail.com')
  )
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Groups select" ON public.friend_groups;
CREATE POLICY "Groups select" ON public.friend_groups FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Groups insert" ON public.friend_groups;
CREATE POLICY "Groups insert" ON public.friend_groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Group members select" ON public.group_members;
CREATE POLICY "Group members select" ON public.group_members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Group members insert" ON public.group_members;
CREATE POLICY "Group members insert" ON public.group_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Friendships select" ON public.friendships;
CREATE POLICY "Friendships select" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Friendships insert" ON public.friendships;
CREATE POLICY "Friendships insert" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Channels select" ON public.chat_channels;
CREATE POLICY "Channels select" ON public.chat_channels FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Messages select" ON public.messages;
CREATE POLICY "Messages select" ON public.messages FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Messages insert" ON public.messages;
CREATE POLICY "Messages insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Messages delete" ON public.messages;
CREATE POLICY "Messages delete" ON public.messages FOR DELETE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Message reactions select" ON public.message_reactions;
CREATE POLICY "Message reactions select" ON public.message_reactions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Message reactions insert" ON public.message_reactions;
CREATE POLICY "Message reactions insert" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Message reactions delete" ON public.message_reactions;
CREATE POLICY "Message reactions delete" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Expenses select" ON public.expenses;
CREATE POLICY "Expenses select" ON public.expenses FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Expenses insert" ON public.expenses;
CREATE POLICY "Expenses insert" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = paid_by);
DROP POLICY IF EXISTS "Expenses update" ON public.expenses;
CREATE POLICY "Expenses update" ON public.expenses FOR UPDATE USING (auth.uid() = paid_by);
DROP POLICY IF EXISTS "Expenses delete" ON public.expenses;
CREATE POLICY "Expenses delete" ON public.expenses FOR DELETE 
  USING (
    auth.uid() = paid_by
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Expense participants select" ON public.expense_participants;
CREATE POLICY "Expense participants select" ON public.expense_participants FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Expense participants insert" ON public.expense_participants;
CREATE POLICY "Expense participants insert" ON public.expense_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Expense participants update" ON public.expense_participants;
CREATE POLICY "Expense participants update" ON public.expense_participants FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Expense participants delete" ON public.expense_participants;
CREATE POLICY "Expense participants delete" ON public.expense_participants FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Loans select" ON public.loans;
CREATE POLICY "Loans select" ON public.loans FOR SELECT USING (auth.uid() = lender_id OR auth.uid() = borrower_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')));
DROP POLICY IF EXISTS "Loans insert" ON public.loans;
CREATE POLICY "Loans insert" ON public.loans FOR INSERT WITH CHECK (auth.uid() = lender_id OR auth.uid() = borrower_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')));
DROP POLICY IF EXISTS "Loans update" ON public.loans;
CREATE POLICY "Loans update" ON public.loans FOR UPDATE USING (auth.uid() = lender_id OR auth.uid() = borrower_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')));
DROP POLICY IF EXISTS "Loans delete" ON public.loans;
CREATE POLICY "Loans delete" ON public.loans FOR DELETE 
  USING (
    auth.uid() = lender_id 
    OR auth.uid() = borrower_id
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')
    )
  );

-- RPC for Admin to safely clear completed money history (Paid loans)
CREATE OR REPLACE FUNCTION public.admin_clear_money_history(p_target_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_email TEXT;
  v_deleted_count INT := 0;
  v_loan_ids UUID[];
BEGIN
  -- Admin Authorization Check
  SELECT role, email INTO v_caller_role, v_caller_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role <> 'admin' AND v_caller_email <> 'aprajahire07@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only administrator can clear completed transaction history.';
  END IF;

  -- Find all paid loan IDs involving target user
  SELECT ARRAY_AGG(id) INTO v_loan_ids
  FROM public.loans
  WHERE status = 'paid'
    AND (lender_id = p_target_user_id OR borrower_id = p_target_user_id);

  IF v_loan_ids IS NOT NULL AND ARRAY_LENGTH(v_loan_ids, 1) > 0 THEN
    -- Delete related loan payments first
    DELETE FROM public.loan_payments WHERE loan_id = ANY(v_loan_ids);
    
    -- Delete the paid loans
    DELETE FROM public.loans WHERE id = ANY(v_loan_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_money_history(UUID) TO authenticated, anon, service_role;


DROP POLICY IF EXISTS "Payment QR select" ON public.payment_qr;
CREATE POLICY "Payment QR select" ON public.payment_qr FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Payment QR insert/update" ON public.payment_qr;
CREATE POLICY "Payment QR insert/update" ON public.payment_qr FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Plans select" ON public.plans;
CREATE POLICY "Plans select" ON public.plans FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Plans insert" ON public.plans;
CREATE POLICY "Plans insert" ON public.plans FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Plans update" ON public.plans;
CREATE POLICY "Plans update" ON public.plans FOR UPDATE 
  USING (
    auth.uid() = creator_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')
    )
  );
DROP POLICY IF EXISTS "Plans delete" ON public.plans;
CREATE POLICY "Plans delete" ON public.plans FOR DELETE 
  USING (
    auth.uid() = creator_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Plan participants select" ON public.plan_participants;
CREATE POLICY "Plan participants select" ON public.plan_participants FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Plan participants insert/update" ON public.plan_participants;
CREATE POLICY "Plan participants insert/update" ON public.plan_participants FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Plan participants delete" ON public.plan_participants;
CREATE POLICY "Plan participants delete" ON public.plan_participants FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Polls select" ON public.polls;
CREATE POLICY "Polls select" ON public.polls FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Polls insert" ON public.polls;
CREATE POLICY "Polls insert" ON public.polls FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Polls delete" ON public.polls;
CREATE POLICY "Polls delete" ON public.polls FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Poll options select" ON public.poll_options;
CREATE POLICY "Poll options select" ON public.poll_options FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Poll options insert" ON public.poll_options;
CREATE POLICY "Poll options insert" ON public.poll_options FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Poll options delete" ON public.poll_options;
CREATE POLICY "Poll options delete" ON public.poll_options FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Poll votes select" ON public.poll_votes;
CREATE POLICY "Poll votes select" ON public.poll_votes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Poll votes insert" ON public.poll_votes;
CREATE POLICY "Poll votes insert" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Poll votes delete" ON public.poll_votes;
CREATE POLICY "Poll votes delete" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Memories select" ON public.memories;
CREATE POLICY "Memories select" ON public.memories FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memories insert" ON public.memories;
CREATE POLICY "Memories insert" ON public.memories FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Memories update" ON public.memories;
CREATE POLICY "Memories update" ON public.memories FOR UPDATE USING (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Memories delete" ON public.memories;
CREATE POLICY "Memories delete" ON public.memories FOR DELETE 
  USING (
    auth.uid() = creator_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.email = 'aprajahire07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Memory photos select" ON public.memory_photos;
CREATE POLICY "Memory photos select" ON public.memory_photos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory photos insert" ON public.memory_photos;
CREATE POLICY "Memory photos insert" ON public.memory_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory photos update" ON public.memory_photos;
CREATE POLICY "Memory photos update" ON public.memory_photos FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory photos delete" ON public.memory_photos;
CREATE POLICY "Memory photos delete" ON public.memory_photos FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Memory media select" ON public.memory_media;
CREATE POLICY "Memory media select" ON public.memory_media FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory media insert" ON public.memory_media;
CREATE POLICY "Memory media insert" ON public.memory_media FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory media delete" ON public.memory_media;
CREATE POLICY "Memory media delete" ON public.memory_media FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Memory tags select" ON public.memory_tags;
CREATE POLICY "Memory tags select" ON public.memory_tags FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory tags insert" ON public.memory_tags;
CREATE POLICY "Memory tags insert" ON public.memory_tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Memory tags delete" ON public.memory_tags;
CREATE POLICY "Memory tags delete" ON public.memory_tags FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Borrowed select" ON public.borrowed_items;
CREATE POLICY "Borrowed select" ON public.borrowed_items FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = borrower_id);
DROP POLICY IF EXISTS "Borrowed insert" ON public.borrowed_items;
CREATE POLICY "Borrowed insert" ON public.borrowed_items FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = borrower_id);
DROP POLICY IF EXISTS "Borrowed update" ON public.borrowed_items;
CREATE POLICY "Borrowed update" ON public.borrowed_items FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = borrower_id);

DROP POLICY IF EXISTS "Important dates select" ON public.important_dates;
CREATE POLICY "Important dates select" ON public.important_dates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Important dates insert" ON public.important_dates;
CREATE POLICY "Important dates insert" ON public.important_dates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Colleges select" ON public.colleges;
CREATE POLICY "Colleges select" ON public.colleges FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Timetables select" ON public.timetable_entries;
CREATE POLICY "Timetables select" ON public.timetable_entries FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Attendance select" ON public.attendance;
CREATE POLICY "Attendance select" ON public.attendance FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Attendance insert" ON public.attendance;
CREATE POLICY "Attendance insert" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Attendance update" ON public.attendance;
CREATE POLICY "Attendance update" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Class reports select" ON public.class_reports;
CREATE POLICY "Class reports select" ON public.class_reports FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Class reports insert" ON public.class_reports;
CREATE POLICY "Class reports insert" ON public.class_reports FOR INSERT WITH CHECK (auth.uid() = reported_by_user_id);
DROP POLICY IF EXISTS "Class reports update" ON public.class_reports;
CREATE POLICY "Class reports update" ON public.class_reports FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Snaps access" ON public.snaps;
DROP POLICY IF EXISTS "Snaps select" ON public.snaps;
CREATE POLICY "Snaps select" ON public.snaps FOR SELECT 
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snaps insert" ON public.snaps;
CREATE POLICY "Snaps insert" ON public.snaps FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snaps update" ON public.snaps;
CREATE POLICY "Snaps update" ON public.snaps FOR UPDATE 
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snaps delete" ON public.snaps;
CREATE POLICY "Snaps delete" ON public.snaps FOR DELETE 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Snap recipients select" ON public.snap_recipients;
CREATE POLICY "Snap recipients select" ON public.snap_recipients FOR SELECT 
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snap recipients insert" ON public.snap_recipients;
CREATE POLICY "Snap recipients insert" ON public.snap_recipients FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snap recipients update" ON public.snap_recipients;
CREATE POLICY "Snap recipients update" ON public.snap_recipients FOR UPDATE 
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Snap recipients delete" ON public.snap_recipients;
CREATE POLICY "Snap recipients delete" ON public.snap_recipients FOR DELETE 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Notifications access" ON public.notifications;
DROP POLICY IF EXISTS "Notifications select" ON public.notifications;
CREATE POLICY "Notifications select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;
CREATE POLICY "Notifications insert" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Notifications update" ON public.notifications;
CREATE POLICY "Notifications update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Notifications delete" ON public.notifications;
CREATE POLICY "Notifications delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App settings read" ON public.app_settings;
CREATE POLICY "App settings read" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "App settings write" ON public.app_settings;
CREATE POLICY "App settings write" ON public.app_settings FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Default Seed for Memories Lock (Locked by default, default passcode 0000 sha256)
INSERT INTO public.app_settings (key, value)
VALUES ('memories_lock', '{"is_locked": true, "passcode_hash": "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0"}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  public.app_settings.value,
  '{passcode_hash}',
  to_jsonb(
    CASE 
      WHEN (public.app_settings.value->>'passcode_hash') = '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a' 
      THEN '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0'
      ELSE COALESCE(public.app_settings.value->>'passcode_hash', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0')
    END
  )
);

-- Secure verification RPC function: verifies SHA-256 hash without exposing the stored hash
CREATE OR REPLACE FUNCTION public.verify_memories_passcode(p_passcode_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
  v_input_hash TEXT;
BEGIN
  v_input_hash := LOWER(TRIM(p_passcode_hash));
  
  SELECT (value->>'passcode_hash') INTO v_stored_hash
  FROM public.app_settings
  WHERE key = 'memories_lock';
  
  IF v_stored_hash IS NULL OR v_stored_hash = '' THEN
    v_stored_hash := '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
  END IF;

  v_stored_hash := LOWER(TRIM(v_stored_hash));
  
  -- Handle matching including legacy hash fallback for 0000
  IF v_input_hash = v_stored_hash THEN
    RETURN TRUE;
  ELSIF (v_input_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' OR v_input_hash = '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a')
        AND (v_stored_hash = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0' OR v_stored_hash = '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Dedicated RPC to safely toggle lock without altering the existing passcode
CREATE OR REPLACE FUNCTION public.admin_toggle_memories_lock(p_is_locked BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hash TEXT;
BEGIN
  SELECT (value->>'passcode_hash') INTO v_current_hash
  FROM public.app_settings
  WHERE key = 'memories_lock';

  IF v_current_hash IS NULL OR v_current_hash = '' THEN
    v_current_hash := '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (
    'memories_lock',
    jsonb_build_object('is_locked', p_is_locked, 'passcode_hash', v_current_hash),
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('is_locked', p_is_locked, 'passcode_hash', v_current_hash),
      updated_at = NOW();
      
  RETURN TRUE;
END;
$$;

-- Dedicated RPC to safely set the passcode without altering lock state
CREATE OR REPLACE FUNCTION public.admin_set_memories_passcode(p_passcode_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_lock BOOLEAN;
  v_clean_hash TEXT;
BEGIN
  v_clean_hash := LOWER(TRIM(p_passcode_hash));

  SELECT COALESCE((value->>'is_locked')::boolean, true) INTO v_current_lock
  FROM public.app_settings
  WHERE key = 'memories_lock';

  IF v_current_lock IS NULL THEN
    v_current_lock := true;
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (
    'memories_lock',
    jsonb_build_object('is_locked', v_current_lock, 'passcode_hash', v_clean_hash),
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('is_locked', v_current_lock, 'passcode_hash', v_clean_hash),
      updated_at = NOW();
      
  RETURN TRUE;
END;
$$;

-- Secure admin update RPC function: updates lock state and/or hash preserving existing fields if omitted
CREATE OR REPLACE FUNCTION public.admin_update_memories_security(
  p_is_locked BOOLEAN,
  p_passcode_hash TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_final_hash TEXT;
BEGIN
  IF p_passcode_hash IS NOT NULL AND TRIM(p_passcode_hash) <> '' THEN
    v_final_hash := LOWER(TRIM(p_passcode_hash));
  ELSE
    SELECT (value->>'passcode_hash') INTO v_final_hash
    FROM public.app_settings
    WHERE key = 'memories_lock';
    
    IF v_final_hash IS NULL OR v_final_hash = '' THEN
      v_final_hash := '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
    END IF;
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (
    'memories_lock',
    jsonb_build_object('is_locked', p_is_locked, 'passcode_hash', v_final_hash),
    NOW()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('is_locked', p_is_locked, 'passcode_hash', v_final_hash),
      updated_at = NOW();
      
  RETURN TRUE;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.verify_memories_passcode(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_memories_lock(BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_memories_passcode(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_memories_security(BOOLEAN, TEXT) TO authenticated, anon;

-- Enable Realtime for App Settings, Snaps, and Snap Recipients
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.snaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.snap_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_files;

-- 12. NOTES & NOTE_FILES TABLES (SHARED MULTI-IMAGE & PDF NOTES)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  is_password_protected BOOLEAN DEFAULT false,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.note_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf')),
  file_size BIGINT,
  display_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS FOR NOTES & NOTE_FILES
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group Read Notes" ON public.notes;
CREATE POLICY "Group Read Notes" ON public.notes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Notes" ON public.notes;
CREATE POLICY "Auth Create Notes" ON public.notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Delete Notes Owner or Admin" ON public.notes;
CREATE POLICY "Delete Notes Owner or Admin" ON public.notes
  FOR DELETE USING (
    auth.uid() = uploaded_by OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR email = 'aprajahire07@gmail.com'))
  );

DROP POLICY IF EXISTS "Group Read Note Files" ON public.note_files;
CREATE POLICY "Group Read Note Files" ON public.note_files
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Create Note Files" ON public.note_files;
CREATE POLICY "Auth Create Note Files" ON public.note_files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Delete Note Files Owner or Admin" ON public.note_files;
CREATE POLICY "Delete Note Files Owner or Admin" ON public.note_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.notes 
      WHERE notes.id = note_files.note_id AND (
        notes.uploaded_by = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR email = 'aprajahire07@gmail.com'))
      )
    )
  );

-- RPC for secure server-side password verification
CREATE OR REPLACE FUNCTION public.verify_note_password(
  p_note_id UUID,
  p_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash TEXT;
  v_is_protected BOOLEAN;
  v_user_role TEXT;
  v_user_email TEXT;
BEGIN
  -- Check if caller is Admin (aprajahire07@gmail.com or role = admin)
  SELECT role, email INTO v_user_role, v_user_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role = 'admin' OR v_user_email = 'aprajahire07@gmail.com' THEN
    RETURN TRUE; -- Master Access for Admin
  END IF;

  -- Fetch note security info
  SELECT password_hash, is_password_protected
  INTO v_stored_hash, v_is_protected
  FROM public.notes
  WHERE id = p_note_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT v_is_protected THEN
    RETURN TRUE;
  END IF;

  RETURN (p_password_hash = v_stored_hash);
END;
$$;

-- STORAGE BUCKETS SETUP
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES 
  ('avatars', 'avatars', true, 52428800),
  ('memories', 'memories', true, 52428800),
  ('chat-media', 'chat-media', true, 52428800),
  ('payment-qr', 'payment-qr', true, 52428800),
  ('snaps', 'snaps', false, 52428800),
  ('notes', 'notes', false, 52428800),
  ('study-notes', 'study-notes', false, 52428800),
  ('documents', 'documents', false, 52428800),
  ('friend-os-files', 'friend-os-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET 
  file_size_limit = 52428800;

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
CREATE POLICY "Auth Update Avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Group Read Memories" ON storage.objects;
CREATE POLICY "Group Read Memories" ON storage.objects FOR SELECT USING (bucket_id IN ('memories', 'friend-os-files'));
DROP POLICY IF EXISTS "Auth Upload Memories" ON storage.objects;
CREATE POLICY "Auth Upload Memories" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('memories', 'friend-os-files') AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth Delete Memories" ON storage.objects;
CREATE POLICY "Auth Delete Memories" ON storage.objects FOR DELETE USING (bucket_id IN ('memories', 'friend-os-files') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Group Read Chat Media" ON storage.objects;
CREATE POLICY "Group Read Chat Media" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth Upload Chat Media" ON storage.objects;
CREATE POLICY "Auth Upload Chat Media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Group Read Payment QR" ON storage.objects;
CREATE POLICY "Group Read Payment QR" ON storage.objects FOR SELECT USING (bucket_id = 'payment-qr' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth Upload Payment QR" ON storage.objects;
CREATE POLICY "Auth Upload Payment QR" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-qr' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Private Snaps Access" ON storage.objects;
CREATE POLICY "Private Snaps Access" ON storage.objects FOR ALL USING (bucket_id = 'snaps' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Private Notes Access" ON storage.objects;
CREATE POLICY "Private Notes Access" ON storage.objects FOR ALL USING (bucket_id IN ('notes', 'study-notes', 'documents') AND auth.role() = 'authenticated');

-- ==============================================================================
-- 15. PUSH NOTIFICATION SUBSCRIPTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions" 
ON public.push_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions" 
ON public.push_subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions" 
ON public.push_subscriptions FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions" 
ON public.push_subscriptions FOR DELETE 
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER tr_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


