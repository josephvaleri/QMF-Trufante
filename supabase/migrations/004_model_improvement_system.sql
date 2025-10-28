-- Model improvement and training system tables
-- Run this in the Supabase SQL Editor

-- Model training data table
create table if not exists public.model_training_data (
  id text primary key,
  question text not null,
  answer text not null,
  normalized_question text,
  created_at timestamptz not null,
  quality_score float default 1.0,
  training_batch_id text,
  created_at_training timestamptz default now()
);

-- Model versions table
create table if not exists public.model_versions (
  id bigserial primary key,
  version text unique not null,
  training_data_count integer not null,
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive', 'testing')),
  performance_metrics jsonb,
  model_config jsonb,
  notes text
);

-- System configuration table
create table if not exists public.system_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

-- Answer quality feedback table
create table if not exists public.answer_feedback (
  id bigserial primary key,
  qna_id bigint references public.qna(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at timestamptz not null default now(),
  model_version text
);

-- Model performance tracking
create table if not exists public.model_performance (
  id bigserial primary key,
  model_version text not null,
  metric_name text not null,
  metric_value float not null,
  measured_at timestamptz not null default now(),
  context jsonb
);

-- Indexes for performance
create index if not exists idx_model_training_data_created_at on public.model_training_data(created_at);
create index if not exists idx_model_versions_status on public.model_versions(status);
create index if not exists idx_answer_feedback_qna_id on public.answer_feedback(qna_id);
create index if not exists idx_answer_feedback_rating on public.answer_feedback(rating);
create index if not exists idx_model_performance_version on public.model_performance(model_version);

-- RLS policies
alter table public.model_training_data enable row level security;
alter table public.model_versions enable row level security;
alter table public.system_config enable row level security;
alter table public.answer_feedback enable row level security;
alter table public.model_performance enable row level security;

-- Model training data: server access only
drop policy if exists "model_training_data_server_only" on public.model_training_data;
create policy "model_training_data_server_only" on public.model_training_data
  for all using (true);

-- Model versions: read access for authenticated users
drop policy if exists "model_versions_read" on public.model_versions;
create policy "model_versions_read" on public.model_versions
  for select using (true);

-- System config: read access for authenticated users
drop policy if exists "system_config_read" on public.system_config;
create policy "system_config_read" on public.system_config
  for select using (true);

-- Answer feedback: users can insert their own feedback
drop policy if exists "answer_feedback_insert" on public.answer_feedback;
create policy "answer_feedback_insert" on public.answer_feedback
  for insert with check (true);

drop policy if exists "answer_feedback_select" on public.answer_feedback;
create policy "answer_feedback_select" on public.answer_feedback
  for select using (true);

-- Model performance: read access for authenticated users
drop policy if exists "model_performance_read" on public.model_performance;
create policy "model_performance_read" on public.model_performance
  for select using (true);

-- Insert initial system configuration
insert into public.system_config (key, value, description) values
  ('current_model_version', 'v1.0.0', 'Current active model version'),
  ('model_improvement_enabled', 'true', 'Whether model improvement is enabled'),
  ('retraining_threshold', '20', 'Number of moderated items before retraining'),
  ('quality_threshold', '0.8', 'Minimum quality score for training data'),
  ('last_retraining_count', '0', 'Last count when retraining was triggered'),
  ('moderated_content_driven', 'true', 'Use moderated Q&A pairs as training data source')
on conflict (key) do nothing;
