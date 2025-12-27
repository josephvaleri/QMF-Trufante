-- Constitutional violations logging table
create table if not exists public.constitutional_violations (
  id bigserial primary key,
  qna_id bigint references public.qna(id) on delete cascade,
  question text not null,
  original_response text not null,
  violations text[] not null,
  violation_categories text[],
  replacement_response text,
  detected_at timestamptz not null default now(),
  model_version text
);

create index if not exists idx_constitutional_violations_detected_at on public.constitutional_violations(detected_at desc);
create index if not exists idx_constitutional_violations_model_version on public.constitutional_violations(model_version);

alter table public.constitutional_violations enable row level security;

-- Server can insert violations
drop policy if exists "constitutional_violations_server_insert" on public.constitutional_violations;
create policy "constitutional_violations_server_insert" on public.constitutional_violations
  for insert with check (true);

-- Only admins can read violations
drop policy if exists "constitutional_violations_admin_read" on public.constitutional_violations;
create policy "constitutional_violations_admin_read" on public.constitutional_violations
  for select using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
  );

