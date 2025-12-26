import { supaServer } from '@/lib/supabase/server';

/**
 * Check if a feature flag is enabled
 * @param flag - Feature flag key
 * @returns true if flag is enabled, false otherwise
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const supabase = supaServer();

  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', flag)
      .single();

    if (error || !data) {
      // Default to false if flag not found or error
      return false;
    }

    return data.value === 'true';
  } catch (error) {
    console.error(`Error checking feature flag ${flag}:`, error);
    return false;
  }
}

