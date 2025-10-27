const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStatus() {
  try {
    console.log('🔍 Checking database status...\n');

    // Check Q&A table
    const { data: qnaData, error: qnaError } = await supabase
      .from('qna')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (qnaError) {
      console.error('❌ Error fetching Q&A data:', qnaError);
    } else {
      console.log('📝 Recent Q&A Records:', qnaData?.length || 0);
      if (qnaData && qnaData.length > 0) {
        qnaData.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          console.log(`     Question: ${record.user_question?.substring(0, 50)}...`);
          console.log(`     Answer: ${record.assistant_answer?.substring(0, 50)}...`);
          console.log(`     User ID: ${record.user_id || 'Anonymous'}`);
          console.log(`     Anon Session: ${record.anon_session_id || 'N/A'}`);
          console.log(`     Created: ${record.created_at}`);
          console.log('');
        });
      } else {
        console.log('  No Q&A records found');
      }
    }

    // Check moderation queue
    const { data: modData, error: modError } = await supabase
      .from('moderation_queue')
      .select('*')
      .order('id', { ascending: false })
      .limit(3);

    if (modError) {
      console.error('❌ Error fetching moderation queue:', modError);
    } else {
      console.log('🔍 Recent Moderation Queue Records:', modData?.length || 0);
      if (modData && modData.length > 0) {
        modData.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          console.log(`     Q&A ID: ${record.qna_id}`);
          console.log(`     Status: ${record.status}`);
          console.log(`     Created: ${record.created_at || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  No moderation queue records found');
      }
    }

    // Test database connection with a simple insert
    console.log('🧪 Testing database connection...');
    const testData = {
      user_question: 'Database connection test',
      assistant_answer: 'This is a test to verify database connectivity',
      user_id: null,
      anon_session_id: `test_${Date.now()}`
    };

    const { data: testInsert, error: testError } = await supabase
      .from('qna')
      .insert(testData)
      .select('id')
      .single();

    if (testError) {
      console.error('❌ Database insert test failed:', testError);
    } else {
      console.log('✅ Database insert test successful:', testInsert);
      
      // Clean up test record
      await supabase.from('qna').delete().eq('id', testInsert.id);
      console.log('🧹 Test record cleaned up');
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabaseStatus();
