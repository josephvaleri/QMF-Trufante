import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params;
    
    // Create Supabase client with cookies for API routes
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is moderator or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'moderator' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { qnaId, editedAnswer, moderatorNotes } = await request.json();

    console.log('Moderation action request:', { action, qnaId, editedAnswer: !!editedAnswer, moderatorNotes: !!moderatorNotes });

    if (!qnaId) {
      return NextResponse.json({ error: 'QnA ID is required' }, { status: 400 });
    }

    const updateData: any = {
      status: action,
      moderator_id: user.id,
      decided_at: new Date().toISOString()
    };

    if (action === 'edit' && editedAnswer) {
      updateData.edited_answer = editedAnswer;
    }

    if (moderatorNotes) {
      updateData.moderator_notes = moderatorNotes;
    }

    // Update the moderation queue item
    console.log('Updating moderation queue with:', { id: qnaId, updateData });
    const { error: updateError } = await supabase
      .from('moderation_queue')
      .update(updateData)
      .eq('id', qnaId);

    if (updateError) {
      console.error('Error updating moderation queue:', updateError);
      return NextResponse.json({ error: 'Failed to update moderation status' }, { status: 500 });
    }

    // Check if we've reached 20 accepted items for retraining
    if (action === 'accept' || action === 'edit') {
      const { count: acceptedCount, error: countError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['accepted', 'edited']);

      if (!countError && acceptedCount && acceptedCount >= 20) {
        // Check if we've already triggered retraining for this batch
        const { data: lastRetraining } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'last_retraining_count')
          .single();

        const lastCount = lastRetraining ? parseInt(lastRetraining.value) : 0;
        
        if (acceptedCount > lastCount) {
          // Trigger retraining process with moderated content
          console.log(`Reached ${acceptedCount} moderated items - triggering model retraining with moderated Q&A pairs`);
          
          try {
            // Update the last retraining count
            await supabase
              .from('system_config')
              .upsert({
                key: 'last_retraining_count',
                value: acceptedCount.toString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'key'
              });

            // Call the retraining script
            const retrainingResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/retrain-model`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (retrainingResponse.ok) {
              const result = await retrainingResponse.json();
              console.log('Model retraining with moderated content completed:', result);
            } else {
              console.error('Failed to trigger model retraining');
            }
          } catch (retrainingError) {
            console.error('Error triggering model retraining:', retrainingError);
          }
        } else {
          console.log(`Retraining already triggered for ${acceptedCount} items (last: ${lastCount})`);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Moderation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}