-- Fix RLS policies to allow moderators to read Q&A data for moderation
-- This allows moderators and admins to read all Q&A records for moderation purposes

-- Add policy for moderators/admins to read all Q&A records
drop policy if exists "qna_select_mods_all" on public.qna;
create policy "qna_select_mods_all" on public.qna
for select using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','moderator'))
);

-- Ensure the policy is applied correctly
-- The existing policies will still work for regular users (own records only)
-- This new policy allows moderators to read any Q&A record for moderation
