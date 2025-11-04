import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    console.log('=== MODERATION API CALLED ===');
    const { action } = await params;
    console.log('Action:', action);
    
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
          set(name: string, value: string, options: any) {
            // No-op for API routes
          },
          remove(name: string, options: any) {
            // No-op for API routes
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check result:', { user: !!user, authError });

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

    // Map action to correct enum value
    const statusMap: { [key: string]: string } = {
      'accept': 'accepted',
      'deny': 'denied',
      'edit': 'edited'
    };
    
    const updateData: any = {
      status: statusMap[action] || action,
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
    const { data: updateData_result, error: updateError } = await supabase
      .from('moderation_queue')
      .update(updateData)
      .eq('id', qnaId)
      .select();

    console.log('Update result:', { updateData_result, updateError });

    if (updateError) {
      console.error('Error updating moderation queue:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update moderation status',
        details: updateError.message 
      }, { status: 500 });
    }

    // Check if retraining should be triggered (only for accepted/edited actions)
    if (action === 'accept' || action === 'edit') {
      try {
        // Get retraining threshold from system config
        const { data: thresholdConfig } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'retraining_threshold')
          .single();
        
        const threshold = parseInt(thresholdConfig?.value || '20', 10);
        
        // Get count of accepted/edited items
        const { count: currentCount, error: countError } = await supabase
          .from('moderation_queue')
          .select('*', { count: 'exact', head: true })
          .in('status', ['accepted', 'edited']);
        
        if (!countError && currentCount !== null) {
          
          console.log(`Retraining check: ${currentCount} accepted/edited items (threshold: ${threshold})`);
          
          // Get last retraining count to avoid duplicate triggers
          const { data: lastRetrainingConfig } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'last_retraining_count')
            .single();
          
          const lastRetrainingCount = parseInt(lastRetrainingConfig?.value || '0', 10);
          
          // Check if we've crossed the threshold and haven't retrained for this batch
          if (currentCount >= threshold && currentCount > lastRetrainingCount) {
            console.log(`Threshold reached! Triggering model retraining with ${currentCount} items...`);
            
            // Update last retraining count BEFORE triggering (to prevent duplicate triggers)
            await supabase
              .from('system_config')
              .upsert({
                key: 'last_retraining_count',
                value: currentCount.toString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'key'
              });
            
            // Trigger retraining asynchronously (don't block moderation response)
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/retrain-model`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            }).then(response => {
              if (response.ok) {
                console.log('Model retraining triggered successfully');
              } else {
                console.error('Failed to trigger model retraining:', response.status);
              }
            }).catch(error => {
              console.error('Error triggering model retraining:', error);
              // Don't fail the moderation action if retraining fails
            });
          }
        }
      } catch (retrainingCheckError) {
        // Log but don't fail moderation if retraining check fails
        console.error('Error checking retraining threshold:', retrainingCheckError);
      }
    }

    console.log('Moderation action completed successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Moderation API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}