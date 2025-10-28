#!/usr/bin/env node

/**
 * Script to create a missing profile for an existing user
 * Usage: node scripts/create-missing-profile.js <user-uuid> [email] [preferred-name]
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

async function createMissingProfile(userId, email, preferredName) {
  try {
    console.log(`🔍 Creating profile for user: ${userId}`);
    
    // First, check if the user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    if (authError) {
      console.error('❌ Error fetching user from auth:', authError.message);
      return false;
    }
    
    if (!authUser.user) {
      console.error('❌ User not found in auth.users');
      return false;
    }
    
    console.log('✅ User found in auth.users:', authUser.user.email);
    
    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();
    
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking existing profile:', profileCheckError.message);
      return false;
    }
    
    if (existingProfile) {
      console.log('⚠️  Profile already exists for this user');
      return true;
    }
    
    // Create the profile
    const profileData = {
      user_id: userId,
      email: email || authUser.user.email,
      role: 'user'
    };
    
    if (preferredName) {
      profileData.preferred_name = preferredName;
    }
    
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();
    
    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message);
      return false;
    }
    
    console.log('✅ Profile created successfully:');
    console.log('   User ID:', newProfile.user_id);
    console.log('   Email:', newProfile.email);
    console.log('   Preferred Name:', newProfile.preferred_name || 'Not set');
    console.log('   Role:', newProfile.role);
    console.log('   Created At:', newProfile.created_at);
    
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node scripts/create-missing-profile.js <user-uuid> [email] [preferred-name]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/create-missing-profile.js dc05e199-9749-4906-b00a-b167cd8fd1f4');
    console.log('  node scripts/create-missing-profile.js dc05e199-9749-4906-b00a-b167cd8fd1f4 user@example.com');
    console.log('  node scripts/create-missing-profile.js dc05e199-9749-4906-b00a-b167cd8fd1f4 user@example.com "John Doe"');
    process.exit(1);
  }
  
  const userId = args[0];
  const email = args[1];
  const preferredName = args[2];
  
  console.log('🔐 Question My Faith - Profile Creation Script');
  console.log('==============================================');
  console.log('');
  console.log('User ID:', userId);
  console.log('Email:', email || 'Will use email from auth.users');
  console.log('Preferred Name:', preferredName || 'Not provided');
  console.log('');
  
  const success = await createMissingProfile(userId, email, preferredName);
  
  if (success) {
    console.log('');
    console.log('🎉 Profile creation completed successfully!');
  } else {
    console.log('');
    console.log('❌ Profile creation failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
