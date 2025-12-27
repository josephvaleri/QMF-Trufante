import { NextRequest, NextResponse } from 'next/server';
import { getActiveModelConfig } from '@/lib/model-config';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getPromptHash } from '@/lib/constitutional-prompt';
import { supaServer } from '@/lib/supabase/server';

export interface VersionInfo {
  version: string;
  deployed_at: string | null;
  intent: string;
  prompt_hash: string | null;
  constraints_enabled: boolean;
  model_config: {
    openai_model: string;
    temperature: number;
    history_window: number;
    vector_store_enabled: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supaServer();
    const modelConfig = await getActiveModelConfig();
    
    // Get model version details
    const { data: modelVersion } = await supabase
      .from('model_versions')
      .select('created_at, prompt_hash, vector_store_id')
      .eq('version', modelConfig.version)
      .eq('status', 'active')
      .single();

    // Get current system prompt hash
    const masterPrompt = process.env.SYSTEM_PROMPT || '';
    const promptHash = masterPrompt ? getPromptHash(masterPrompt) : null;

    const constraintsEnabled = await isFeatureEnabled('constitutional_constraints_enabled');

    const versionInfo: VersionInfo = {
      version: modelConfig.version,
      deployed_at: modelVersion?.created_at || null,
      intent: 'Bounded conversational system with constitutional constraints - reactive-only faith engagement',
      prompt_hash: modelVersion?.prompt_hash || promptHash,
      constraints_enabled: constraintsEnabled,
      model_config: {
        openai_model: modelConfig.openai_model,
        temperature: modelConfig.temperature,
        history_window: modelConfig.history_window,
        vector_store_enabled: !!modelConfig.vector_store_id,
      },
    };

    return NextResponse.json(versionInfo);
  } catch (error) {
    console.error('Error getting version info:', error);
    return NextResponse.json(
      { error: 'Failed to get version info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

