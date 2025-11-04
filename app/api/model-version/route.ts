import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = supaServer();
    
    // Get the current active model version
    const { data: currentVersion } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_model_version')
      .single();
    
    const modelVersion = currentVersion?.value || null;
    
    if (!modelVersion) {
      return NextResponse.json({ 
        error: 'No model version configured' 
      }, { status: 404 });
    }
    
    // Get model version details
    const { data: modelVersionData, error: modelError } = await supabase
      .from('model_versions')
      .select('*')
      .eq('version', modelVersion)
      .single();
    
    if (modelError || !modelVersionData) {
      return NextResponse.json({ 
        error: 'Model version not found',
        details: modelError?.message 
      }, { status: 404 });
    }
    
    // Get training data count for this model
    const { count: trainingDataCount } = await supabase
      .from('model_training_data')
      .select('*', { count: 'exact', head: true })
      .eq('training_batch_id', modelVersionData.model_config?.training_batch_id || '');
    
    // Get all training data sources breakdown
    const { data: allTrainingData } = await supabase
      .from('model_training_data')
      .select('id, source, training_batch_id')
      .limit(1000);
    
    const moderatedCount = allTrainingData?.filter(td => td.id?.startsWith('moderated_training_')).length || 0;
    const vectorStoreCount = allTrainingData?.filter(td => td.id?.startsWith('vector_store_file_')).length || 0;
    
    return NextResponse.json({
      success: true,
      modelVersion: {
        version: modelVersionData.version,
        status: modelVersionData.status,
        created_at: modelVersionData.created_at,
        training_data_count: modelVersionData.training_data_count,
        performance_metrics: modelVersionData.performance_metrics,
        model_config: modelVersionData.model_config
      },
      trainingDataBreakdown: {
        total: modelVersionData.training_data_count,
        moderated_qna_pairs: moderatedCount,
        vector_store_files: vectorStoreCount,
        other: modelVersionData.training_data_count - moderatedCount - vectorStoreCount
      },
      vectorStore: {
        enabled: modelVersionData.performance_metrics?.vector_store_enabled || false,
        vector_store_id: modelVersionData.performance_metrics?.vector_store_id,
        file_count: modelVersionData.performance_metrics?.vector_store_file_count || 0,
        files_used_in_training: modelVersionData.performance_metrics?.vector_store_files_count || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching model version:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

