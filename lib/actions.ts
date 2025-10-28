'use server'

import { supaServer } from '@/lib/supabase/server'

export async function getQnAData(qnaIds: number[]) {
  try {
    const supabase = await supaServer()
    
    const { data, error } = await supabase
      .from('qna')
      .select('id, user_question, assistant_answer, created_at')
      .in('id', qnaIds)

    if (error) {
      console.error('Error fetching Q&A data:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Unexpected error fetching Q&A data:', error)
    return { data: null, error: 'Unexpected error occurred' }
  }
}

// New function to get moderation queue with joined Q&A data
export async function getModerationQueueWithQnA() {
  try {
    const supabase = await supaServer()
    
    const { data, error } = await supabase
      .from('moderation_queue')
      .select(`
        id,
        qna_id,
        status,
        moderator_notes,
        edited_answer,
        decided_at,
        moderator_id,
        auto_flags,
        source,
        qna:qna_id (
          id,
          user_question,
          assistant_answer,
          created_at
        )
      `)
      .order('id', { ascending: false })

    if (error) {
      console.error('Error fetching moderation queue with Q&A:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Unexpected error fetching moderation queue:', error)
    return { data: null, error: 'Unexpected error occurred' }
  }
}
