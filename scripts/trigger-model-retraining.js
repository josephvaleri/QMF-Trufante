#!/usr/bin/env node

/**
 * Script to trigger model retraining when 20+ items are accepted
 * This script should be called when the moderation queue reaches 20 accepted items
 */

import { createServiceClient } from '../lib/supabase/service.js';

async function triggerModelRetraining() {
  const supabase = createServiceClient();
  
  try {
    console.log('Checking if model retraining should be triggered...');

    // Get count of accepted/edited items
    const { data: acceptedItems, error: countError } = await supabase
      .from('moderation_queue')
      .select('id', { count: 'exact' })
      .in('status', ['accepted', 'edited']);

    if (countError) {
      throw countError;
    }

    const acceptedCount = acceptedItems?.length || 0;
    console.log(`Current accepted/edited items: ${acceptedCount}`);

    if (acceptedCount < 20) {
      console.log('Not enough accepted items for retraining (need 20+)');
      return;
    }

    console.log('Triggering model retraining...');

    // Get the accepted Q&A pairs for retraining
    const { data: trainingData, error: dataError } = await supabase
      .from('qna_accepted')
      .select('user_question, answer')
      .order('created_at', { ascending: false })
      .limit(20);

    if (dataError) {
      throw dataError;
    }

    if (!trainingData || trainingData.length === 0) {
      console.log('No training data available');
      return;
    }

    console.log(`Preparing ${trainingData.length} Q&A pairs for retraining`);

    // Format data for OpenAI fine-tuning
    const formattedData = trainingData.map(item => ({
      messages: [
        {
          role: "user",
          content: item.user_question
        },
        {
          role: "assistant", 
          content: item.answer
        }
      ]
    }));

    // Save formatted data to file for OpenAI fine-tuning
    const fs = require('fs');
    const path = require('path');
    
    const outputPath = path.join(process.cwd(), 'data', 'retraining_data.jsonl');
    
    // Ensure data directory exists
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write JSONL file
    const jsonlContent = formattedData.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync(outputPath, jsonlContent);

    console.log(`Training data saved to: ${outputPath}`);
    console.log('Ready for OpenAI fine-tuning upload');

    // TODO: Implement actual OpenAI fine-tuning API call
    // This would involve:
    // 1. Uploading the JSONL file to OpenAI
    // 2. Creating a fine-tuning job
    // 3. Monitoring the job status
    // 4. Updating the application to use the new model

    console.log('\nNext steps:');
    console.log('1. Upload the JSONL file to OpenAI for fine-tuning');
    console.log('2. Create a fine-tuning job');
    console.log('3. Update the application configuration with the new model ID');

  } catch (error) {
    console.error('Error triggering model retraining:', error);
    process.exit(1);
  }
}

// Run the script
triggerModelRetraining();
