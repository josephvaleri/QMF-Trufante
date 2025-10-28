-- Manual SQL script to fix the infinite recursion in profiles RLS policy
-- Run this in the Supabase SQL Editor

-- Step 1: Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

-- Step 2: Create a simpler policy that only allows users to access their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

-- Step 3: Verify the policies are correct
-- You can run this to see all policies on the profiles table:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'profiles';

-- Step 4: Test the fix by trying to select a profile
-- This should work without infinite recursion:
-- SELECT * FROM public.profiles WHERE user_id = 'dc05e199-9749-4906-b00a-b167cd8fd1f4';
