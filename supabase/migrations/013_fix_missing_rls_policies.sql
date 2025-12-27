-- Fix missing RLS INSERT policies for evaluation tables and audit_log
-- These tables need server-side inserts from API routes using service role key

-- Evaluation tables: Add server insert policies
-- Drop if exists first (CREATE POLICY doesn't support IF NOT EXISTS)
drop policy if exists "eval_sets_server_insert" on public.eval_sets;
create policy "eval_sets_server_insert" on public.eval_sets
  for insert with check (true);

drop policy if exists "eval_cases_server_insert" on public.eval_cases;
create policy "eval_cases_server_insert" on public.eval_cases
  for insert with check (true);

drop policy if exists "eval_runs_server_insert" on public.eval_runs;
create policy "eval_runs_server_insert" on public.eval_runs
  for insert with check (true);

drop policy if exists "eval_case_results_server_insert" on public.eval_case_results;
create policy "eval_case_results_server_insert" on public.eval_case_results
  for insert with check (true);

-- Audit log: Add server insert policy
drop policy if exists "audit_log_server_insert" on public.audit_log;
create policy "audit_log_server_insert" on public.audit_log
  for insert with check (true);

