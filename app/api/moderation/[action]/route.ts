import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supabase/server";
import { z } from "zod";

const actions = ['accept','deny','edit'] as const;
const paramsSchema = z.object({ action: z.enum(actions) });
const bodySchema = z.object({
  qna_id: z.number(),
  edited_answer: z.string().optional(),
  moderator_notes: z.string().optional()
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const params = await ctx.params;
    const { action } = paramsSchema.parse(params);
    const supa = supaServer();

    // Require moderator/admin
    const { data: auth } = await supa.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: me } = await supa.from('profiles').select('role').eq('user_id', auth.user.id).single();
    if (!me || !['moderator','admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { qna_id, edited_answer, moderator_notes } = bodySchema.parse(await req.json());
    const status = action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : 'edited';

    const { error } = await supa
      .from('moderation_queue')
      .update({
        status,
        moderator_id: auth.user.id,
        moderator_notes: moderator_notes ?? null,
        edited_answer: action === 'edit' ? (edited_answer ?? '') : null,
        decided_at: new Date().toISOString()
      })
      .eq('qna_id', qna_id)
      .eq('status', 'pending');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error('Moderation API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
