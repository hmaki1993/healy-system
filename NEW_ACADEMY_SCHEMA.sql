-- ============================================================
-- FULL SCHEMA EXPORT - HEALY ACADEMY SYSTEM
-- ============================================================
-- HOW TO USE:
-- 1. Create a new Supabase project for your new academy.
-- 2. Open the SQL Editor in the new project.
-- 3. Copy and paste this ENTIRE file and click "Run".
-- 4. Done! Your database is ready.
-- ============================================================

-- STEP 1: Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- STEP 2: Create Enum Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'head_coach', 'coach', 'reception', 'cleaner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'knet', 'credit', 'bank_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ================================================================
-- CORE TABLES
-- ================================================================

-- [1] Profiles (Links to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role user_role DEFAULT 'coach',
  avatar_url TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  pt_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [2] Students
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  birth_date DATE,
  phone TEXT,
  father_phone TEXT,
  mother_phone TEXT,
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  photo_url TEXT,
  coach_id UUID REFERENCES public.profiles(id),
  training_days TEXT[] DEFAULT '{}',
  training_schedule JSONB,
  sessions_remaining INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  plan_id UUID,
  subscription_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [3] Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  coach_id UUID REFERENCES public.profiles(id),
  days TEXT[],
  start_time TIME,
  end_time TIME,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [4] Student-Group link
CREATE TABLE IF NOT EXISTS public.student_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, group_id)
);

-- [5] Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INTEGER DEFAULT 1,
  sessions_limit INTEGER,
  sessions_per_week INTEGER DEFAULT 3,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [6] Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  plan_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT TRUE,
  payment_method payment_method DEFAULT 'cash',
  sessions_limit INTEGER,
  sessions_remaining INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [7] Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  status attendance_status DEFAULT 'present',
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [8] Coach Attendance
CREATE TABLE IF NOT EXISTS public.coach_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  status TEXT DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FINANCE TABLES
-- ================================================================

-- [9] Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [10] Expenses / General Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [11] Refunds
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id),
  amount DECIMAL(10,2) NOT NULL,
  refund_date DATE DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PT (Personal Training) TABLES
-- ================================================================

-- [12] PT Subscriptions
CREATE TABLE IF NOT EXISTS public.pt_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id),
  coach_id UUID REFERENCES public.profiles(id),
  student_name TEXT,
  sessions_total INTEGER NOT NULL DEFAULT 10,
  sessions_used INTEGER DEFAULT 0,
  price_per_session DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  coach_share DECIMAL(5,2) DEFAULT 50,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [13] PT Attendance
CREATE TABLE IF NOT EXISTS public.pt_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pt_subscription_id UUID REFERENCES public.pt_subscriptions(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'completed', 'absent')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- NOTIFICATIONS & VOICE BROADCAST
-- ================================================================

-- [14] Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  related_student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  related_coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [15] Voice Broadcasts (Walkie-Talkie)
CREATE TABLE IF NOT EXISTS public.voice_broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id),
  audio_url TEXT NOT NULL,
  duration DECIMAL(5,2),
  target_users UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- GYM SETTINGS
-- ================================================================

-- [16] Gym Settings
CREATE TABLE IF NOT EXISTS public.gym_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_name TEXT DEFAULT 'New Academy',
  academy_name TEXT DEFAULT 'New Academy',
  gym_address TEXT DEFAULT 'Cairo, Egypt',
  gym_phone TEXT DEFAULT '+20 123 456 7890',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  primary_color TEXT DEFAULT '#ef4444',
  secondary_color TEXT DEFAULT '#1f2937',
  sidebar_bg TEXT DEFAULT '#0F1923',
  header_bg TEXT DEFAULT '#0F1923',
  card_bg TEXT DEFAULT '#1a2634',
  text_color TEXT DEFAULT '#ffffff',
  accent_color TEXT DEFAULT '#ef4444',
  button_color TEXT DEFAULT '#ef4444',
  button_text_color TEXT DEFAULT '#ffffff',
  hover_color TEXT DEFAULT '#dc2626',
  input_bg_color TEXT DEFAULT '#1e2a38',
  search_icon_color TEXT DEFAULT '#94a3b8',
  currency TEXT DEFAULT 'EGP',
  currency_symbol TEXT DEFAULT 'ج.م',
  language TEXT DEFAULT 'ar',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO public.gym_settings (gym_name, academy_name) 
VALUES ('New Academy', 'New Academy')
ON CONFLICT DO NOTHING;


-- ================================================================
-- ENABLE ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- RLS POLICIES
-- ================================================================

-- Profiles
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Students / Groups / Plans / Subscriptions / Attendance / Finance
CREATE POLICY "Enable all for authenticated" ON public.students FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.groups FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.student_groups FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.subscription_plans FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.subscriptions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.attendance FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.coach_attendance FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.payments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.expenses FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.refunds FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.pt_subscriptions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.pt_attendance FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.voice_broadcasts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Enable all for authenticated" ON public.gym_settings FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Notifications
CREATE POLICY "Notifications viewable by all authenticated" ON public.notifications FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Allow delete notifications" ON public.notifications FOR DELETE TO authenticated USING (TRUE);


-- ================================================================
-- TRIGGERS & FUNCTIONS
-- ================================================================

-- Auto-create profile on Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'coach')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Auto-sync email from profiles to auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE auth.users SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_email_updated ON public.profiles;
CREATE TRIGGER on_profile_email_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_email_to_auth();


-- Notification: New Student
CREATE OR REPLACE FUNCTION public.notify_new_student_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (title, message, type, related_student_id, related_coach_id, target_role)
  VALUES ('New Gymnast', NEW.full_name || ' just registered', 'student', NEW.id, NEW.coach_id, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_student_created ON public.students;
CREATE TRIGGER on_student_created
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_student_v2();


-- Notification: New Payment
CREATE OR REPLACE FUNCTION public.notify_new_payment_v2()
RETURNS TRIGGER AS $$
DECLARE student_name TEXT; student_coach_id UUID;
BEGIN
  SELECT full_name, coach_id INTO student_name, student_coach_id FROM public.students WHERE id = NEW.student_id;
  INSERT INTO public.notifications (title, message, type, related_student_id, related_coach_id, target_role)
  VALUES ('Payment Received', COALESCE(NEW.amount::TEXT, '0') || ' from ' || COALESCE(student_name, 'Unknown'), 'payment', NEW.student_id, student_coach_id, 'admin_reception');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_created ON public.payments;
CREATE TRIGGER on_payment_created
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_payment_v2();


-- Notification: New PT Subscription
CREATE OR REPLACE FUNCTION public.notify_new_pt_subscription()
RETURNS TRIGGER AS $$
DECLARE student_name TEXT; coach_name TEXT;
BEGIN
  SELECT full_name INTO student_name FROM public.students WHERE id = NEW.student_id;
  SELECT full_name INTO coach_name FROM public.profiles WHERE id = NEW.coach_id;
  INSERT INTO public.notifications (title, message, type, related_student_id, related_coach_id)
  VALUES ('New PT Subscription', COALESCE(student_name, 'Student') || ' subscribed to PT with ' || COALESCE(coach_name, 'Coach'), 'pt_subscription', NEW.student_id, NEW.coach_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pt_subscription_created ON public.pt_subscriptions;
CREATE TRIGGER on_pt_subscription_created
  AFTER INSERT ON public.pt_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_pt_subscription();


-- RPC: Delete user by ID (called by Admin UI)
CREATE OR REPLACE FUNCTION public.delete_user_by_id(user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_user_by_id TO authenticated;


-- ================================================================
-- ENABLE REALTIME
-- ================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_broadcasts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_attendance; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ================================================================
-- ALL DONE! Your new academy database is ready.
-- Next: Update your .env file with the new Supabase URL and ANON_KEY
-- ================================================================
