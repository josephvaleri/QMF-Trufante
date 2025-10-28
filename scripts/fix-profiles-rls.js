#!/usr/bin/env node

/**
 * Script to fix the infinite recursion in profiles RLS policy
 * This script connects directly to Supabase and fixes the problematic policy
 */

const { createServiceClient } = require('../lib/supabase/service.cjs');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixProfilesRLS() {
  try {
    console.log('🔧 Fixing profiles RLS policy...');
    
    // Drop the problematic policy
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;'
    });
    
    if (dropError) {
      console.error('❌ Error dropping policy:', dropError.message);
      return false;
    }
    
    console.log('✅ Dropped problematic policy');
    
    // Create a simpler policy
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "profiles_select_own" ON public.profiles
            FOR SELECT USING (auth.uid() = user_id);`
    });
    
    if (createError) {
      console.error('❌ Error creating new policy:', createError.message);
      return false;
    }
    
    console.log('✅ Created new simplified policy');
    
    // Test the fix by trying to read a profile
    console.log('🧪 Testing profile access...');
    const { data: testProfile, error: testError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', 'dc05e199-9749-4906-b00a-b167cd8fd1f4')
      .single();
    
    if (testError) {
      console.error('❌ Test failed:', testError.message);
      return false;
    }
    
    console.log('✅ Profile access test successful');
    console.log('📋 Profile data:', {
      user_id: testProfile.user_id,
      email: testProfile.email,
      preferred_name: testProfile.preferred_name,
      role: testProfile.role
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔐 Question My Faith - RLS Policy Fix');
  console.log('=====================================');
  console.log('');
  
  const success = await fixProfilesRLS();
  
  if (success) {
    console.log('');
    console.log('🎉 RLS policy fix completed successfully!');
    console.log('   The profile page should now load without errors.');
  } else {
    console.log('');
    console.log('❌ RLS policy fix failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
