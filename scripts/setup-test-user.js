#!/usr/bin/env node

/**
 * Script to create a test user with Moderator role for Playwright tests
 * This script uses the Supabase service client to create the user directly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease check your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function setupTestUser() {
  try {
    console.log('🔧 Setting up test moderator user...');
    
    const testUser = {
      email: 'testuser@passionworksstudio.com',
      password: 'TestPassword123!',
      preferred_name: 'Test User',
      role: 'moderator'
    };
    
    // Check if user already exists
    console.log('🔍 Checking if test user already exists...');
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('user_id, email, role, preferred_name')
      .eq('email', testUser.email)
      .single();
    
    if (existingProfile && !checkError) {
      console.log('⚠️  Test user already exists:');
      console.log(`   Email: ${existingProfile.email}`);
      console.log(`   Name: ${existingProfile.preferred_name}`);
      console.log(`   Role: ${existingProfile.role}`);
      console.log(`   User ID: ${existingProfile.user_id}`);
      
      // Update role to moderator if not already
      if (existingProfile.role !== 'moderator') {
        console.log('🔄 Updating role to moderator...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'moderator' })
          .eq('user_id', existingProfile.user_id);
        
        if (updateError) {
          throw updateError;
        }
        console.log('✅ Role updated to moderator');
      } else {
        console.log('✅ User already has moderator role');
      }
      
      console.log('\n🎉 Test user setup complete!');
      console.log('📧 Email: testuser@passionworksstudio.com');
      console.log('🔑 Password: TestPassword123!');
      console.log('👑 Role: moderator');
      
      return existingProfile;
    }
    
    // Create new user in auth.users table
    console.log('👤 Creating auth user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true
    });
    
    if (authError) {
      throw authError;
    }
    
    console.log('✅ Auth user created:', authUser.user.id);
    
    // Create profile with moderator role
    console.log('📝 Creating profile with moderator role...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        email: testUser.email,
        preferred_name: testUser.preferred_name,
        role: testUser.role
      })
      .select()
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    console.log('✅ Profile created successfully:');
    console.log(`   User ID: ${profile.user_id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Name: ${profile.preferred_name}`);
    console.log(`   Role: ${profile.role}`);
    
    console.log('\n🎉 Test user setup complete!');
    console.log('📧 Email: testuser@passionworksstudio.com');
    console.log('🔑 Password: TestPassword123!');
    console.log('👑 Role: moderator');
    
    return profile;
    
  } catch (error) {
    console.error('❌ Error setting up test user:', error);
    process.exit(1);
  }
}

// Run the script
setupTestUser();
