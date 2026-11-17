-- ============================================================================
-- HomeTutor: Quick Auth & Test User Activation
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/csykyhjhzoivwnpcxwbr/sql)
-- ============================================================================

-- 1. Auto-confirm any pending test users (e.g., testparent@hometutor.app)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. Automatic Profile Generator Trigger
-- Ensures every new user automatically gets a full profile in public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_invite_code TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  
  IF v_role = 'parent' THEN
    v_invite_code := upper(substring(md5(random()::text) from 1 for 6));
  ELSE
    v_invite_code := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    invite_code,
    subscription_tier,
    daily_test_limit,
    max_children_allowed,
    subjects
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_role,
    v_invite_code,
    'premium',
    999,
    10,
    ARRAY['Math', 'Science', 'English']
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    subscription_tier = 'premium',
    daily_test_limit = 999,
    max_children_allowed = 10;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill profiles for any auth users that already exist (such as testparent@hometutor.app)
INSERT INTO public.profiles (
  id,
  name,
  email,
  role,
  invite_code,
  subscription_tier,
  daily_test_limit,
  max_children_allowed,
  subjects
)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'Sarah Jenkins (Test Parent)'),
  u.email,
  COALESCE(u.raw_user_meta_data->>'role', 'parent'),
  'PAR888',
  'premium',
  999,
  10,
  ARRAY['Math', 'Science', 'English']
FROM auth.users u
WHERE u.email = 'testparent@hometutor.app'
ON CONFLICT (id) DO UPDATE SET
  subscription_tier = 'premium',
  invite_code = 'PAR888';

