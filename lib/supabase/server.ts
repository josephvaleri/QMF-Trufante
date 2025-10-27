import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_key';

export const supaServer = () =>
  createClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { persistSession: false } }
  );
