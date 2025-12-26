-- Track knowledge pack artifacts
create table if not exists public.knowledge_packs (
  id bigserial primary key,
  pack_version text unique not null,  -- e.g., "kp-v1.0.0-1234567890"
  model_version text not null references public.model_versions(version) on delete cascade,
  file_id text,  -- OpenAI file ID after upload
  vector_store_id text,  -- Vector store this pack is added to
  content_metadata jsonb,  -- {curated_count, framework_included, created_from, etc.}
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_knowledge_packs_model_version on public.knowledge_packs(model_version);

alter table public.knowledge_packs enable row level security;

create policy "knowledge_packs_server_insert" on public.knowledge_packs
  for insert with check (true);

create policy "knowledge_packs_authenticated_read" on public.knowledge_packs
  for select using (true);

