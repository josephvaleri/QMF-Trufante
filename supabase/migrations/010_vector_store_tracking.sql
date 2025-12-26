-- Track which OpenAI files belong to which knowledge pack/version
create table if not exists public.vector_store_files (
  id bigserial primary key,
  file_id text not null unique,  -- OpenAI file ID
  vector_store_id text not null,
  knowledge_pack_id bigint references public.knowledge_packs(id) on delete set null,
  model_version text references public.model_versions(version) on delete set null,
  file_name text,
  uploaded_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_vector_store_files_pack on public.vector_store_files(knowledge_pack_id);
create index if not exists idx_vector_store_files_version on public.vector_store_files(model_version);
create index if not exists idx_vector_store_files_active on public.vector_store_files(is_active, vector_store_id);

alter table public.vector_store_files enable row level security;

create policy "vector_store_files_server_all" on public.vector_store_files for all using (true);

