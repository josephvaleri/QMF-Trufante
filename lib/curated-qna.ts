import { supaServer } from '@/lib/supabase/server';
import { embed } from './openai';

export interface CuratedQnARow {
  id: number;
  qna_id: number;
  question: string;
  answer: string;
  question_embedding: number[];
  source_moderation_id: number | null;
  curated_at: string;
  curated_by: string | null;
  updated_at: string;
}

export interface SimilarCuratedResult {
  id: number;
  question: string;
  answer: string;
  score: number;
}

/**
 * Upsert a curated Q&A pair with embedding
 */
export async function upsertCuratedQnA(
  qnaId: number,
  question: string,
  answer: string,
  curatorId?: string,
  moderationId?: number
): Promise<CuratedQnARow> {
  const supabase = supaServer();

  // Generate embedding for the question
  const questionEmbedding = await embed(question);

  // Upsert into curated_qna table
  // Note: Supabase accepts arrays directly for vector types
  const { data, error } = await supabase
    .from('curated_qna')
    .upsert(
      {
        qna_id: qnaId,
        question,
        answer,
        question_embedding: questionEmbedding, // Pass as array of numbers
        curated_by: curatorId || null,
        source_moderation_id: moderationId || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'qna_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting curated Q&A:', error);
    throw new Error(`Failed to upsert curated Q&A: ${error.message}`);
  }

  return data as CuratedQnARow;
}

/**
 * Find similar curated Q&A pairs by question
 */
export async function findSimilarCurated(
  question: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<SimilarCuratedResult[]> {
  const supabase = supaServer();

  // Generate embedding for the query question
  const queryEmbedding = await embed(question);

  // Call the PostgreSQL function
  // Pass embedding as array directly
  const { data, error } = await supabase.rpc('find_similar_curated', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    console.error('Error finding similar curated Q&A:', error);
    // Return empty array on error rather than throwing (non-critical)
    return [];
  }

  return (data || []) as SimilarCuratedResult[];
}

