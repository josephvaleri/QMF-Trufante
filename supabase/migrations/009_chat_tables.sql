-- Chat sessions table
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chat messages table
create table if not exists public.chat_messages (
  id bigserial primary key,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_user_id on public.chat_sessions(user_id, updated_at desc);
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- RLS: users can only access their own sessions
create policy "chat_sessions_user_select" on public.chat_sessions
  for select using (auth.uid() = user_id);

create policy "chat_sessions_user_insert" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

create policy "chat_sessions_user_update" on public.chat_sessions
  for update using (auth.uid() = user_id);

create policy "chat_messages_user_select" on public.chat_messages
  for select using (
    exists (select 1 from public.chat_sessions cs where cs.id = chat_messages.session_id and cs.user_id = auth.uid())
  );

create policy "chat_messages_user_insert" on public.chat_messages
  for insert with check (
    exists (select 1 from public.chat_sessions cs where cs.id = chat_messages.session_id and cs.user_id = auth.uid())
  );

