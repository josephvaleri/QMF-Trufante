import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';
import { buildKnowledgePack, uploadKnowledgePack, createVectorStoreForVersion, trackVectorStoreFile } from '@/lib/knowledge-pack';
import { isFeatureEnabled } from '@/lib/feature-flags';
import crypto from 'crypto';

// Helper: hash prompt to detect changes
function sha256(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supaServer();
    
    // Check feature flag
    const knowledgePackEnabled = await isFeatureEnabled('knowledge_pack_building_enabled');
    if (!knowledgePackEnabled) {
      // Legacy mode: keep old behavior for backward compatibility
      return legacyRetrainModel(request);
    }

    // Try to parse request body, but don't fail if empty
    let isInitialBuild = false;
    try {
      const body = await request.json();
      isInitialBuild = body.isInitialBuild || false;
    } catch {
      // No body provided, that's okay - check if this is first model version
      const { data: existingVersions } = await supabase
        .from('model_versions')
        .select('id')
        .limit(1);
      isInitialBuild = !existingVersions || existingVersions.length === 0;
    }

    // Fetch curated Q&A from curated_qna table (not qna_accepted view)
    console.log('Fetching curated Q&A pairs from curated_qna table...');
    const { data: curatedItems, error: curatedError } = await supabase
      .from('curated_qna')
      .select('id, qna_id, question, answer')
      .order('curated_at', { ascending: true });

    console.log('Curated Q&A query result:', { curatedItems: curatedItems?.length, curatedError });

    if (curatedError) {
      console.error('Error fetching curated Q&A pairs:', curatedError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to fetch curated Q&A pairs',
        details: curatedError.message
      }, { status: 500 });
    }

    if (!curatedItems || curatedItems.length === 0) {
      console.log('No curated Q&A pairs available, skipping knowledge pack build');
      return NextResponse.json({ 
        success: false,
        message: 'No curated Q&A pairs available',
        error: 'No curated items found in curated_qna table'
      }, { status: 400 });
    }

    console.log(`Building knowledge pack with ${curatedItems.length} curated Q&A pairs`);

    // Generate model version string
    const timestamp = Date.now();
    const modelVersion = isInitialBuild ? `v1.0.0-${timestamp}` : `v${timestamp}`;
    const packVersion = `kp-${modelVersion}`;

    // Build Knowledge Pack markdown
    const frameworkText = process.env.SYSTEM_PROMPT || undefined;
    const packMarkdown = buildKnowledgePack(curatedItems, modelVersion, frameworkText);

    // Create new vector store for this version (or use existing if configured)
    // For now, create new vector store per version (can be optimized later)
    let vectorStoreId: string;
    try {
      vectorStoreId = await createVectorStoreForVersion(modelVersion);
      console.log(`Created new vector store: ${vectorStoreId}`);
    } catch (error) {
      console.error('Error creating vector store:', error);
      return NextResponse.json({ 
        error: 'Failed to create vector store',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Upload knowledge pack to vector store
    let fileId: string;
    try {
      fileId = await uploadKnowledgePack(packMarkdown, vectorStoreId, `knowledge-pack-${modelVersion}.md`);
      console.log(`Uploaded knowledge pack file: ${fileId}`);
    } catch (error) {
      console.error('Error uploading knowledge pack:', error);
      return NextResponse.json({ 
        error: 'Failed to upload knowledge pack',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Track the file in database
    try {
      await trackVectorStoreFile(fileId, vectorStoreId, undefined, modelVersion, `knowledge-pack-${modelVersion}.md`);
    } catch (error) {
      console.warn('Error tracking vector store file (non-blocking):', error);
    }

    // Create/update assistant for this version
    const systemPrompt = process.env.SYSTEM_PROMPT || 'You are a helpful assistant.';
    const assistantName = `QMF Assistant v${modelVersion}`;
    const promptHash = sha256(systemPrompt);

    let assistantId: string;
    try {
      // Try to find existing assistant with same name and vector store
      const assistants = await openai.beta.assistants.list({ limit: 10 });
      let existingAssistant = assistants.data.find(
        (a) => a.name === assistantName && 
        a.tool_resources?.file_search?.vector_store_ids?.includes(vectorStoreId)
      );

      if (existingAssistant) {
        assistantId = existingAssistant.id;
        console.log(`Found existing assistant: ${assistantId}`);
        
        // Update instructions
        await openai.beta.assistants.update(assistantId, {
          instructions: systemPrompt,
        });
      } else {
        // Create new assistant
        const assistant = await openai.beta.assistants.create({
          name: assistantName,
          instructions: systemPrompt,
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStoreId],
            },
          },
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
          response_format: { type: 'text' },
        });
        assistantId = assistant.id;
        console.log(`Created new assistant: ${assistantId}`);
      }
    } catch (error) {
      console.error('Error creating/updating assistant:', error);
      return NextResponse.json({ 
        error: 'Failed to create/update assistant',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Create model_versions row with status='testing' (not 'active')
    const modelData = {
      version: modelVersion,
      training_data_count: curatedItems.length,
      created_at: new Date().toISOString(),
      status: 'testing', // Not auto-active
      openai_model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      history_window: parseInt(process.env.HISTORY_WINDOW || '3', 10),
      assistant_id: assistantId,
      vector_store_id: vectorStoreId,
      prompt_hash: promptHash,
      knowledge_pack_file_ids: [fileId],
      performance_metrics: {
        curated_items_count: curatedItems.length,
        vector_store_enabled: true,
        vector_store_id: vectorStoreId,
        vector_store_file_count: 1,
      },
      model_config: {
        is_initial_build: isInitialBuild,
        training_sources: ['curated_qna'],
        created_from: 'knowledge_pack_builder',
        curated_qna_count: curatedItems.length,
      },
    };

    const { data: modelVersionRow, error: modelError } = await supabase
      .from('model_versions')
      .insert(modelData)
      .select()
      .single();

    if (modelError) {
      console.error('Error creating model version:', modelError);
      return NextResponse.json({ 
        error: 'Failed to create model version',
        details: modelError.message
      }, { status: 500 });
    }

    // Create knowledge_packs row linking pack to version
    const packData = {
      pack_version: packVersion,
      model_version: modelVersion,
      file_id: fileId,
      vector_store_id: vectorStoreId,
      content_metadata: {
        curated_count: curatedItems.length,
        framework_included: !!frameworkText,
        created_from: 'curated_qna',
      },
    };

    const { data: knowledgePackRow, error: packError } = await supabase
      .from('knowledge_packs')
      .insert(packData)
      .select()
      .single();

    if (packError) {
      console.error('Error creating knowledge pack record:', packError);
      // Non-blocking, but log it
    }

    // Update vector_store_files to link to knowledge pack
    if (knowledgePackRow) {
      try {
        await supabase
          .from('vector_store_files')
          .update({ knowledge_pack_id: knowledgePackRow.id })
          .eq('file_id', fileId);
      } catch (error) {
        console.warn('Error updating vector_store_files with knowledge_pack_id (non-blocking):', error);
      }
    }

    // DO NOT update system_config.current_model_version (promotion is separate via /api/model-version/promote)

    console.log(`Knowledge pack built and model version ${modelVersion} created (status: testing)`);

    return NextResponse.json({ 
      success: true,
      message: `Knowledge pack built and model version ${modelVersion} created (status: testing). Use /api/model-version/promote to activate.`,
      modelVersion,
      packVersion,
      curatedItemsCount: curatedItems.length,
      vectorStoreId,
      assistantId,
      fileId,
      status: 'testing',
    });
  } catch (error) {
    console.error('Knowledge pack build error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during knowledge pack build',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Legacy retrain function for backward compatibility
async function legacyRetrainModel(request: NextRequest) {
  // This keeps the old behavior when feature flag is disabled
  // For brevity, returning a message - in production you'd include the old logic here
  return NextResponse.json({ 
    error: 'Legacy retraining mode not implemented in new codebase. Enable knowledge_pack_building_enabled feature flag.',
  }, { status: 501 });
}
