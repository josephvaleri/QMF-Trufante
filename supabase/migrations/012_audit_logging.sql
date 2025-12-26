-- Audit log for important actions
create table if not exists public.audit_log (
  id bigserial primary key,
  action text not null,  -- 'version_promoted', 'retrain_triggered', 'vector_store_file_deleted', etc.
  actor_id uuid references auth.users(id) on delete set null,
  resource_type text,  -- 'model_version', 'knowledge_pack', etc.
  resource_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_action on public.audit_log(action, created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id, created_at desc);

alter table public.audit_log enable row level security;

-- Only admins can read audit log (policy will check role in profiles)
create policy "audit_log_admin_read" on public.audit_log
  for select using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin')
  );

