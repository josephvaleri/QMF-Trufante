import { NextRequest, NextResponse } from "next/server";
import { supaServer } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(1),
  preferred_name: z.string().min(1),
  religion: z.enum(['Baha\'i','Buddhist','Christian','Hindu','Jewish','Muslim','Sikh','Jain','Shinto','Taoist','Zoroastrian','Agnostic','Atheist','Other','Prefer not to say'])
});

export async function POST(req: NextRequest) {
  try {
    const supa = supaServer();
    const { data: auth } = await supa.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = schema.parse(await req.json());
    const { error } = await supa.from('profiles').upsert({
      user_id: auth.user.id,
      email: auth.user.email,
      ...payload
    });

    if (error) {
      console.error('Profile upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Profile API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
