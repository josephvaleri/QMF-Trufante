-- Fix infinite recursion in profiles RLS policy
-- The issue is that the policy tries to check user role by querying profiles table
-- which creates circular dependency

-- Drop the problematic policy
drop policy if exists "profiles_select_own_or_admin" on public.profiles;

-- Create a simpler policy that only allows users to access their own profile
-- For admin/moderator access, we'll handle this at the application level
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);

-- Keep the existing update and insert policies as they are correct
-- profiles_update_self and profiles_insert_self are fine

-- Optional: Create a function to check if user is admin/moderator
-- This can be used in application code if needed
create or replace function public.is_admin_or_moderator()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles 
    where user_id = auth.uid() 
    and role in ('admin', 'moderator')
  );
$$;
