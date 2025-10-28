-- Add crisis detection fields to moderation_queue
alter table public.moderation_queue 
add column if not exists auto_flags jsonb,
add column if not exists source text;

