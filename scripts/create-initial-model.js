#!/usr/bin/env node

/**
 * Script to create the initial model version using:
 * - 17 moderated items from moderation_queue
 * - Vector Store metadata (extensive training data)
 * 
 * This creates the first model version in model_versions table
 */

const { createServiceClient } = require('../lib/supabase/service.cjs');
const OpenAI = require('openai');

async function createInitialModel() {
  const supabase = createServiceClient();
  
  try {
    console.log('=== Creating Initial Model Version ===\n');
    
    // Check if model versions already exist
    const { data: existingVersions, error: checkError } = await supabase
      .from('model_versions')
      .select('id, version')
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing models:', checkError);
      process.exit(1);
    }
    
    if (existingVersions && existingVersions.length > 0) {
      console.log('⚠️  Model versions already exist:');
      existingVersions.forEach(v => console.log(`   - ${v.version}`));
      console.log('\nUse the retrain-model API endpoint to create new versions.\n');
      process.exit(0);
    }
    
    console.log('1. Fetching moderated Q&A pairs...');
    
    // Get all accepted/edited Q&A pairs
    const { data: acceptedQna, error: qnaError } = await supabase
      .from('qna_accepted')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (qnaError) {
      console.error('❌ Error fetching accepted Q&A pairs:', qnaError);
      process.exit(1);
    }
    
    if (!acceptedQna || acceptedQna.length === 0) {
      console.error('❌ No moderated Q&A pairs found in qna_accepted view');
      console.log('   Make sure you have accepted/edited items in the moderation_queue table');
      process.exit(1);
    }
    
    console.log(`✅ Found ${acceptedQna.length} moderated Q&A pairs\n`);
    
    // Get Vector Store information
    let vectorStoreInfo = null;
    if (process.env.VECTOR_STORE_ID && process.env.OPENAI_API_KEY) {
      console.log('2. Retrieving Vector Store information...');
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        
        // @ts-ignore - vectorStores API exists but may not be in TypeScript types yet
        const vectorStore = await openai.beta.vectorStores.retrieve(process.env.VECTOR_STORE_ID);
        vectorStoreInfo = {
          vector_store_id: vectorStore.id,
          name: vectorStore.name,
          file_counts: vectorStore.file_counts,
          status: vectorStore.status,
          usage_bytes: vectorStore.usage_bytes
        };
        
        console.log(`✅ Vector Store: ${vectorStoreInfo.name}`);
        console.log(`   Status: ${vectorStoreInfo.status}`);
        console.log(`   Files: ${vectorStoreInfo.file_counts?.completed || 0} completed`);
        console.log(`   Usage: ${(vectorStoreInfo.usage_bytes / 1024 / 1024).toFixed(2)} MB\n`);
      } catch (vectorStoreError) {
        console.warn('⚠️  Could not retrieve Vector Store info:', vectorStoreError.message);
        console.log('   Continuing without Vector Store metadata...\n');
      }
    } else {
      console.log('⚠️  VECTOR_STORE_ID or OPENAI_API_KEY not set, skipping Vector Store info\n');
    }
    
    console.log('3. Creating training data...');
    
    // Create training data from moderated Q&A pairs
    const trainingData = acceptedQna.map((qna, index) => ({
      id: `moderated_training_${qna.id}_${index + 1}`,
      question: qna.user_question,
      answer: qna.answer,
      normalized_question: qna.user_question_norm,
      created_at: qna.created_at,
      quality_score: 1.0, // High quality since it was moderated and accepted
      source: 'moderated_content',
      moderation_approved: true
    }));
    
    console.log(`✅ Prepared ${trainingData.length} training data entries\n`);
    
    console.log('4. Storing training data in model_training_data table...');
    
    // Store training data
    const { error: trainingError } = await supabase
      .from('model_training_data')
      .upsert(trainingData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (trainingError) {
      console.error('❌ Error storing training data:', trainingError);
      process.exit(1);
    }
    
    console.log('✅ Training data stored\n');
    
    console.log('5. Creating model version...');
    
    // Create initial model version
    const timestamp = Date.now();
    const modelVersion = `v1.0.0-${timestamp}`;
    
    const modelData = {
      version: modelVersion,
      training_data_count: acceptedQna.length,
      created_at: new Date().toISOString(),
      status: 'active', // First version is active
      performance_metrics: {
        accuracy: 0.95, // Placeholder - would be calculated from actual performance
        confidence: 0.88,
        response_time: 1.2,
        moderated_items_count: acceptedQna.length,
        vector_store_enabled: !!vectorStoreInfo,
        vector_store_id: vectorStoreInfo?.vector_store_id || null,
        vector_store_file_count: vectorStoreInfo?.file_counts?.completed || vectorStoreInfo?.file_counts?.in_progress || 0
      },
      model_config: {
        is_initial_build: true,
        training_sources: ['moderated_content', ...(vectorStoreInfo ? ['vector_store'] : [])],
        created_from: 'moderated_qna_pairs',
        vector_store_info: vectorStoreInfo
      }
    };
    
    const { data: modelVersionData, error: modelError } = await supabase
      .from('model_versions')
      .insert(modelData)
      .select()
      .single();
    
    if (modelError) {
      console.error('❌ Error creating model version:', modelError);
      process.exit(1);
    }
    
    console.log(`✅ Model version created: ${modelVersion}`);
    console.log(`   Status: ${modelData.status}`);
    console.log(`   Training data count: ${acceptedQna.length}`);
    if (vectorStoreInfo) {
      console.log(`   Vector Store: ${vectorStoreInfo.file_counts?.completed || 0} files`);
    }
    console.log();
    
    // Calculate and store insights
    console.log('6. Calculating and storing performance metrics...');
    
    const questionTypes = trainingData.map(td => ({
      length: td.question.length,
      wordCount: td.question.split(' ').length,
      hasQuestionMark: td.question.includes('?'),
      emotionalWords: (td.question.match(/\b(feel|hurt|pain|sad|angry|confused|lost|struggle|doubt|fear|hope|love|peace|joy)\b/gi) || []).length
    }));
    
    const answerTypes = trainingData.map(td => ({
      length: td.answer.length,
      wordCount: td.answer.split(' ').length,
      hasScripture: td.answer.match(/\b(scripture|bible|god|jesus|christ|faith|prayer|pray)\b/gi)?.length || 0,
      isEmpathetic: td.answer.match(/\b(understand|hear|feel|care|support|here|with you)\b/gi)?.length || 0
    }));
    
    const avgQuestionLength = questionTypes.reduce((sum, qt) => sum + qt.length, 0) / questionTypes.length;
    const avgAnswerLength = answerTypes.reduce((sum, at) => sum + at.length, 0) / answerTypes.length;
    const emotionalContentRatio = questionTypes.reduce((sum, qt) => sum + qt.emotionalWords, 0) / questionTypes.length;
    const empatheticResponseRatio = answerTypes.reduce((sum, at) => sum + at.isEmpathetic, 0) / answerTypes.length;
    
    await supabase.from('model_performance').insert({
      model_version: modelVersion,
      metric_name: 'moderated_content_insights',
      metric_value: 1.0,
      context: {
        avg_question_length: avgQuestionLength,
        avg_answer_length: avgAnswerLength,
        emotional_content_ratio: emotionalContentRatio,
        empathetic_response_ratio: empatheticResponseRatio,
        training_data_count: trainingData.length,
        source: 'moderated_content_analysis',
        vector_store_enabled: !!vectorStoreInfo,
        vector_store_file_count: vectorStoreInfo?.file_counts?.completed || 0
      }
    });
    
    console.log('✅ Performance metrics stored\n');
    
    // Update system configuration
    console.log('7. Updating system configuration...');
    
    const { error: configError } = await supabase
      .from('system_config')
      .upsert({
        key: 'current_model_version',
        value: modelVersion,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });
    
    if (configError) {
      console.error('⚠️  Error updating system config:', configError);
    } else {
      console.log(`✅ System configured to use model version: ${modelVersion}\n`);
    }
    
    console.log('=== Initial Model Creation Complete ===\n');
    console.log(`Model Version: ${modelVersion}`);
    console.log(`Training Data: ${acceptedQna.length} moderated Q&A pairs`);
    if (vectorStoreInfo) {
      console.log(`Vector Store: ${vectorStoreInfo.file_counts?.completed || 0} files available`);
    }
    console.log(`Status: ${modelData.status}`);
    console.log();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
createInitialModel();

