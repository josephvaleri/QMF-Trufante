-- Add runtime configuration columns to model_versions
alter table public.model_versions 
  add column if not exists openai_model text,
  add column if not exists temperature float,
  add column if not exists history_window int,
  add column if not exists assistant_id text,
  add column if not exists vector_store_id text,
  add column if not exists prompt_hash text,
  add column if not exists knowledge_pack_file_ids text[];  -- Array of OpenAI file IDs

-- Update existing rows with defaults (migration path)
update public.model_versions
set 
  openai_model = COALESCE(openai_model, 'gpt-4o'),
  temperature = COALESCE(temperature, 0.3),
  history_window = COALESCE(history_window, 3),
  vector_store_id = COALESCE(vector_store_id, (select value from system_config where key = 'VECTOR_STORE_ID' limit 1))
where openai_model is null or temperature is null or history_window is null;

-- Add index for active versions lookup
create index if not exists idx_model_versions_status_active on public.model_versions(status, created_at desc) 
  where status = 'active';

