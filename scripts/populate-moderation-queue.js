#!/usr/bin/env node

/**
 * Script to populate moderation queue with existing Q&A items
 * This should be run once to backfill the moderation queue
 */

import { createServiceClient } from '../lib/supabase/service.js';

async function populateModerationQueue() {
  const supabase = createServiceClient();
  
  try {
    console.log('Starting moderation queue population...');

    // Get all Q&A items that don't already have moderation queue entries
    const { data: qnaItems, error: qnaError } = await supabase
      .from('qna')
      .select(`
        id,
        user_question,
        assistant_answer,
        created_at
      `)
      .not('assistant_answer', 'is', null)
      .order('created_at', { ascending: false });

    if (qnaError) {
      throw qnaError;
    }

    console.log(`Found ${qnaItems?.length || 0} Q&A items to process`);

    if (!qnaItems || qnaItems.length === 0) {
      console.log('No Q&A items found to process');
      return;
    }

    // Get existing moderation queue entries to avoid duplicates
    const { data: existingEntries, error: existingError } = await supabase
      .from('moderation_queue')
      .select('qna_id');

    if (existingError) {
      throw existingError;
    }

    const existingQnaIds = new Set(existingEntries?.map(entry => entry.qna_id) || []);
    const itemsToProcess = qnaItems.filter(item => !existingQnaIds.has(item.id));

    console.log(`${itemsToProcess.length} new items to add to moderation queue`);

    if (itemsToProcess.length === 0) {
      console.log('All Q&A items already have moderation queue entries');
      return;
    }

    // Insert new moderation queue entries
    const moderationEntries = itemsToProcess.map(item => ({
      qna_id: item.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('moderation_queue')
      .insert(moderationEntries);

    if (insertError) {
      throw insertError;
    }

    console.log(`Successfully added ${moderationEntries.length} items to moderation queue`);

    // Show summary
    const { data: summary, error: summaryError } = await supabase
      .from('moderation_queue')
      .select('status')
      .not('status', 'is', null);

    if (!summaryError && summary) {
      const statusCounts = summary.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\nModeration Queue Summary:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }

  } catch (error) {
    console.error('Error populating moderation queue:', error);
    process.exit(1);
  }
}

// Run the script
populateModerationQueue();
