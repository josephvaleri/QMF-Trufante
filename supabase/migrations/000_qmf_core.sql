-- Enable pgvector (for 90% reuse)
create extension if not exists vector;

-- Enums
do $$ begin
  create type user_role as enum ('user','moderator','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_status as enum ('pending','accepted','denied','edited');
exception when duplicate_object then null; end $$;

-- Profiles (optional auth)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  preferred_name text,
  religion text check (religion in (
    'Baha''i','Buddhist','Christian','Hindu','Jewish','Muslim','Sikh',
    'Jain','Shinto','Taoist','Zoroastrian','Agnostic','Atheist','Other','Prefer not to say'
  )),
  role user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.touch_profiles_updated_at();

-- Anonymous sessions (cookie correlation for guests)
create table if not exists public.anon_sessions (
  session_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Q&A rows (pair in same row)
create table if not exists public.qna (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  anon_session_id uuid references public.anon_sessions(session_id) on delete set null,
  user_question text not null,
  user_question_norm text generated always as (lower(trim(user_question))) stored,
  assistant_answer text,
  created_at timestamptz not null default now()
);
create index if not exists idx_qna_user_question_norm on public.qna(user_question_norm);

-- Embeddings (for reuse match)
create table if not exists public.qna_embeddings (
  qna_id bigint primary key references public.qna(id) on delete cascade,
  question_embedding vector(1536)
);
create index if not exists idx_qna_embeddings_vec on public.qna_embeddings
using ivfflat (question_embedding vector_cosine_ops) with (lists=100);

-- Moderation queue
create table if not exists public.moderation_queue (
  id bigserial primary key,
  qna_id bigint not null references public.qna(id) on delete cascade,
  status moderation_status not null default 'pending',
  moderator_id uuid references auth.users(id) on delete set null,
  moderator_notes text,
  edited_answer text,
  decided_at timestamptz
);
create index if not exists idx_moderation_status on public.moderation_queue(status);

-- Accepted/Edited knowledge view (used for reuse)
create or replace view public.qna_accepted as
select
  q.id,
  q.user_question,
  q.user_question_norm,
  coalesce(m.edited_answer, q.assistant_answer) as answer,
  q.created_at
from public.qna q
join public.moderation_queue m on m.qna_id = q.id
where m.status in ('accepted','edited');

-- RLS
alter table public.profiles enable row level security;
alter table public.anon_sessions enable row level security;
alter table public.qna enable row level security;
alter table public.qna_embeddings enable row level security;
alter table public.moderation_queue enable row level security;

-- Profiles: owner read/write; mods/admins can read all
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = user_id);
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = user_id);

-- anon_sessions: open insert/select (cookie-based)
drop policy if exists "anon_sessions_insert_any" on public.anon_sessions;
create policy "anon_sessions_insert_any" on public.anon_sessions for insert to anon with check (true);
drop policy if exists "anon_sessions_select_any" on public.anon_sessions;
create policy "anon_sessions_select_any" on public.anon_sessions for select to anon using (true);

-- qna: anyone can insert; only owner can read own
drop policy if exists "qna_insert_any" on public.qna;
create policy "qna_insert_any" on public.qna for insert to anon with check (true);
drop policy if exists "qna_insert_auth" on public.qna;
create policy "qna_insert_auth" on public.qna for insert to authenticated with check (true);
drop policy if exists "qna_select_own_authed" on public.qna;
create policy "qna_select_own_authed" on public.qna for select to authenticated using (user_id = auth.uid());
drop policy if exists "qna_select_own_anon" on public.qna;
create policy "qna_select_own_anon" on public.qna for select to anon using (anon_session_id is not null);

-- qna_embeddings: server writes; optional read for authed
revoke all on public.qna_embeddings from anon, authenticated;
grant select on public.qna_embeddings to authenticated;

-- moderation_queue: mods/admins only
drop policy if exists "mod_queue_mods_only_select" on public.moderation_queue;
create policy "mod_queue_mods_only_select" on public.moderation_queue
for select using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists "mod_queue_mods_only_update" on public.moderation_queue;
create policy "mod_queue_mods_only_update" on public.moderation_queue
for update using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists "mod_queue_any_insert" on public.moderation_queue;
create policy "mod_queue_any_insert" on public.moderation_queue
for insert to anon, authenticated with check (true);

-- RPCs for vector search (distance threshold)
create or replace function public.match_qna(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table(id bigint, user_question text, answer text, score float)
language sql stable as $$
  select q.id, q.user_question, q.answer,
         1 - (qe.question_embedding <=> query_embedding) as score
  from public.qna_accepted q
  join public.qna_embeddings qe on qe.qna_id = q.id
  where (qe.question_embedding <-> query_embedding) < match_threshold
  order by qe.question_embedding <-> query_embedding
  limit match_count;
$$;
