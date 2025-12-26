-- Insert feature flags (defaults to false for safety)
insert into public.system_config (key, value, description) values
  ('curated_guidance_enabled', 'false', 'Enable curated Q&A guidance in system prompt'),
  ('vector_store_autoupload_enabled', 'false', 'Auto-upload curated items to vector store on moderation'),
  ('model_version_testing_enabled', 'false', 'Enable model version testing workflow'),
  ('eval_required_before_promotion', 'false', 'Require evaluation before promoting version to active'),
  ('knowledge_pack_building_enabled', 'false', 'Enable knowledge pack building in retrain endpoint')
on conflict (key) do nothing;

