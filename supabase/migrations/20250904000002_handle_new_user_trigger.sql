-- ============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
-- This trigger creates a default user_profiles row whenever a new
-- auth.users row is inserted. It is idempotent — if the client also
-- inserts a profile (e.g. during signup), the ON CONFLICT clause
-- skips the duplicate.
--
-- Why SECURITY DEFINER: the inserting session is a freshly-created
-- auth user. RLS on user_profiles requires `auth.uid() = user_id`,
-- which works, but to make the trigger robust against future policy
-- changes we run as the function owner (postgres) and only ever
-- insert the row that matches NEW.id.
--
-- This migration fixes a bug where the trigger was defined in
-- supabase-schema.sql but never split into a migration, so the
-- remote database never had it — causing the
-- "new row violates row-level security policy for table user_profiles"
-- error on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
