import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params;
    const supabase = createClient();
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
      const { data: acceptedCount, error: countError } = await supabase
        .from('moderation_queue')
        .select('id', { count: 'exact' })
        .in('status', ['accepted', 'edited']);

      if (!countError && acceptedCount && acceptedCount.length >= 20) {
        // Trigger retraining process
        console.log('Reached 20 accepted items - triggering model retraining');
        // TODO: Implement actual retraining logic here
        // This could involve calling an external API or triggering a background job
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Moderation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}