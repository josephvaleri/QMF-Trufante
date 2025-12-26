-- Create curated_qna table for storing moderated/edited Q&A pairs with embeddings
create table if not exists public.curated_qna (
  id bigserial primary key,
  qna_id bigint not null references public.qna(id) on delete cascade,
  question text not null,
  answer text not null,  -- edited_answer if edited, otherwise original
  question_embedding vector(1536) not null,  -- pgvector embedding
  source_moderation_id bigint references public.moderation_queue(id) on delete set null,
  curated_at timestamptz not null default now(),
  curated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  -- Index for similarity search
  constraint curated_qna_qna_id_unique unique (qna_id)
);

create index if not exists idx_curated_qna_embedding on public.curated_qna
  using ivfflat (question_embedding vector_cosine_ops) with (lists=100);

create index if not exists idx_curated_qna_curated_at on public.curated_qna(curated_at desc);

alter table public.curated_qna enable row level security;

-- RLS: server writes, authenticated read
create policy "curated_qna_server_insert" on public.curated_qna
  for insert with check (true);

create policy "curated_qna_authenticated_read" on public.curated_qna
  for select using (true);

-- Function to find similar curated Q&A pairs
create or replace function public.find_similar_curated(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table(
  id bigint,
  question text,
  answer text,
  score float
)
language sql stable as $$
  select 
    cq.id,
    cq.question,
    cq.answer,
    1 - (cq.question_embedding <=> query_embedding) as score
  from public.curated_qna cq
  where (cq.question_embedding <-> query_embedding) < (1 - match_threshold)
  order by cq.question_embedding <-> query_embedding
  limit match_count;
$$;

