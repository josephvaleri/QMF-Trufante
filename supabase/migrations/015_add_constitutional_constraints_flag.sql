-- Add feature flag for constitutional constraints
insert into public.system_config (key, value, description) values
  ('constitutional_constraints_enabled', 'false', 'Enable constitutional constraints for bounded conversational system')
on conflict (key) do nothing;

