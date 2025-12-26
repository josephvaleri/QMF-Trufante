-- Evaluation sets (collections of test cases)
create table if not exists public.eval_sets (
  id bigserial primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Individual test cases
create table if not exists public.eval_cases (
  id bigserial primary key,
  eval_set_id bigint not null references public.eval_sets(id) on delete cascade,
  question text not null,
  expected_criteria jsonb,  -- {min_length, max_length, required_phrases: [], forbidden_phrases: []}
  reference_answer text,  -- Optional ideal answer
  created_at timestamptz not null default now()
);

-- Evaluation runs (testing a version against a set)
create table if not exists public.eval_runs (
  id bigserial primary key,
  model_version text not null references public.model_versions(version) on delete cascade,
  eval_set_id bigint not null references public.eval_sets(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary_metrics jsonb  -- {total_cases, passed_automated, avg_score, etc.}
);

-- Results for each case in a run
create table if not exists public.eval_case_results (
  id bigserial primary key,
  eval_run_id bigint not null references public.eval_runs(id) on delete cascade,
  eval_case_id bigint not null references public.eval_cases(id) on delete cascade,
  model_response text not null,
  automated_checks jsonb,  -- {length_ok, required_phrases_found, forbidden_phrases_absent}
  automated_score float,  -- 0-1 based on checks
  human_score float,  -- Optional, set later
  human_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_eval_runs_version on public.eval_runs(model_version, started_at desc);
create index if not exists idx_eval_case_results_run on public.eval_case_results(eval_run_id);

alter table public.eval_sets enable row level security;
alter table public.eval_cases enable row level security;
alter table public.eval_runs enable row level security;
alter table public.eval_case_results enable row level security;

-- RLS: authenticated read, server/moderator write
create policy "eval_sets_read" on public.eval_sets for select using (true);
create policy "eval_cases_read" on public.eval_cases for select using (true);
create policy "eval_runs_read" on public.eval_runs for select using (true);
create policy "eval_case_results_read" on public.eval_case_results for select using (true);

