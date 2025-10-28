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