import { supaServer } from '@/lib/supabase/server';

export interface ModelConfig {
  version: string;
  openai_model: string;
  temperature: number;
  history_window: number;
  assistant_id: string | null;
  vector_store_id: string | null;
  prompt_hash: string | null;
  knowledge_pack_file_ids: string[];
}

const DEFAULT_CONFIG: Omit<ModelConfig, 'version'> = {
  openai_model: 'gpt-4o',
  temperature: 0.3,
  history_window: 3,
  assistant_id: null,
  vector_store_id: null,
  prompt_hash: null,
  knowledge_pack_file_ids: [],
};

/**
 * Get the active model configuration
 */
export async function getActiveModelConfig(): Promise<ModelConfig> {
  const supabase = supaServer();

  try {
    // Get current model version from system_config
    const { data: versionConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'current_model_version')
      .single();

    const currentVersion = versionConfig?.value || 'v1.0.0';

    // Get model version details
    const { data: modelVersion, error } = await supabase
      .from('model_versions')
      .select('*')
      .eq('version', currentVersion)
      .eq('status', 'active')
      .single();

    if (error || !modelVersion) {
      console.warn(`Active model version ${currentVersion} not found, using defaults`);
      return {
        version: currentVersion,
        ...DEFAULT_CONFIG,
        vector_store_id: process.env.VECTOR_STORE_ID || null,
      };
    }

    // Return config with defaults for null values
    return {
      version: modelVersion.version,
      openai_model: modelVersion.openai_model || DEFAULT_CONFIG.openai_model,
      temperature: modelVersion.temperature ?? DEFAULT_CONFIG.temperature,
      history_window: modelVersion.history_window ?? DEFAULT_CONFIG.history_window,
      assistant_id: modelVersion.assistant_id || null,
      vector_store_id: modelVersion.vector_store_id || process.env.VECTOR_STORE_ID || null,
      prompt_hash: modelVersion.prompt_hash || null,
      knowledge_pack_file_ids: modelVersion.knowledge_pack_file_ids || [],
    };
  } catch (error) {
    console.error('Error loading active model config:', error);
    // Return defaults on error
    return {
      version: 'v1.0.0',
      ...DEFAULT_CONFIG,
      vector_store_id: process.env.VECTOR_STORE_ID || null,
    };
  }
}

/**
 * Get model configuration for a specific version
 */
export async function getModelConfigForVersion(version: string): Promise<ModelConfig | null> {
  const supabase = supaServer();

  try {
    const { data: modelVersion, error } = await supabase
      .from('model_versions')
      .select('*')
      .eq('version', version)
      .single();

    if (error || !modelVersion) {
      return null;
    }

    return {
      version: modelVersion.version,
      openai_model: modelVersion.openai_model || DEFAULT_CONFIG.openai_model,
      temperature: modelVersion.temperature ?? DEFAULT_CONFIG.temperature,
      history_window: modelVersion.history_window ?? DEFAULT_CONFIG.history_window,
      assistant_id: modelVersion.assistant_id || null,
      vector_store_id: modelVersion.vector_store_id || process.env.VECTOR_STORE_ID || null,
      prompt_hash: modelVersion.prompt_hash || null,
      knowledge_pack_file_ids: modelVersion.knowledge_pack_file_ids || [],
    };
  } catch (error) {
    console.error(`Error loading model config for version ${version}:`, error);
    return null;
  }
}

