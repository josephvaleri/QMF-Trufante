#!/usr/bin/env node

/**
 * Script to create a test user with Moderator role
 * Email: testuser@passionworksstudio.com
 * Name: Test User
 * Role: moderator
 */

import { createServiceClient } from '../lib/supabase/service.ts';

async function createTestModerator() {
  const supabase = createServiceClient();
  
  try {
    console.log('🔧 Creating test moderator user...');
    
    const testUser = {
      email: 'testuser@passionworksstudio.com',
      preferred_name: 'Test User',
      role: 'moderator'
    };
    
    // First, check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('user_id, email, role')
      .eq('email', testUser.email)
      .single();
    
    if (existingUser && !checkError) {
      console.log('⚠️  Test user already exists:');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   User ID: ${existingUser.user_id}`);
      
      // Update role to moderator if not already
      if (existingUser.role !== 'moderator') {
        console.log('🔄 Updating role to moderator...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'moderator' })
          .eq('user_id', existingUser.user_id);
        
        if (updateError) {
          throw updateError;
        }
        console.log('✅ Role updated to moderator');
      } else {
        console.log('✅ User already has moderator role');
      }
      
      return existingUser;
    }
    
    // Create new user in auth.users table (this requires service role key)
    console.log('👤 Creating auth user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: 'TestPassword123!',
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
    
    console.log('\n🎉 Test moderator user created successfully!');
    console.log('📧 Email: testuser@passionworksstudio.com');
    console.log('🔑 Password: TestPassword123!');
    console.log('👑 Role: moderator');
    
    return profile;
    
  } catch (error) {
    console.error('❌ Error creating test moderator:', error);
    process.exit(1);
  }
}

// Run the script
createTestModerator();
