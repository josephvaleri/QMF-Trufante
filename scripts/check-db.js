const { createServiceClient } = require('../lib/supabase/service.cjs');

async function checkDatabase() {
  const supabase = createServiceClient();
  
  try {
    console.log('🔍 Checking database contents...\n');

    // Check Q&A table
    const { data: qnaData, error: qnaError } = await supabase
      .from('qna')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (qnaError) {
      console.error('❌ Error fetching Q&A data:', qnaError);
    } else {
      console.log('📝 Q&A Records:', qnaData?.length || 0);
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
      }
    }

    // Check moderation queue
    const { data: modData, error: modError } = await supabase
      .from('moderation_queue')
      .select('*')
      .order('id', { ascending: false })
      .limit(5);

    if (modError) {
      console.error('❌ Error fetching moderation queue:', modError);
    } else {
      console.log('🔍 Moderation Queue Records:', modData?.length || 0);
      if (modData && modData.length > 0) {
        modData.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          console.log(`     Q&A ID: ${record.qna_id}`);
          console.log(`     Status: ${record.status}`);
          console.log(`     Created: ${record.created_at || 'N/A'}`);
          console.log('');
        });
      }
    }

    // Check anonymous sessions
    const { data: anonData, error: anonError } = await supabase
      .from('anon_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (anonError) {
      console.error('❌ Error fetching anonymous sessions:', anonError);
    } else {
      console.log('👤 Anonymous Sessions:', anonData?.length || 0);
      if (anonData && anonData.length > 0) {
        anonData.forEach((record, index) => {
          console.log(`  ${index + 1}. Session ID: ${record.session_id}`);
          console.log(`     Created: ${record.created_at}`);
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();

