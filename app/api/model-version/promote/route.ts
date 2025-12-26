import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { z } from 'zod';

const promoteSchema = z.object({
  version: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = supaServer();

    // Parse and validate request body
    const body = await request.json();
    const { version } = promoteSchema.parse(body);

    // Verify version exists and status is 'testing'
    const { data: modelVersion, error: fetchError } = await supabase
      .from('model_versions')
      .select('version, status')
      .eq('version', version)
      .single();

    if (fetchError || !modelVersion) {
      return NextResponse.json(
        { error: 'Model version not found' },
        { status: 404 }
      );
    }

    if (modelVersion.status !== 'testing') {
      return NextResponse.json(
        { error: 'Only testing versions can be promoted to active' },
        { status: 400 }
      );
    }

    // Deactivate current active version
    const { error: deactivateError } = await supabase
      .from('model_versions')
      .update({ status: 'inactive' })
      .eq('status', 'active');

    if (deactivateError) {
      console.error('Error deactivating previous version:', deactivateError);
      return NextResponse.json(
        { error: 'Failed to deactivate previous version' },
        { status: 500 }
      );
    }

    // Activate new version
    const { error: activateError } = await supabase
      .from('model_versions')
      .update({ status: 'active' })
      .eq('version', version);

    if (activateError) {
      console.error('Error activating version:', activateError);
      return NextResponse.json(
        { error: 'Failed to activate version' },
        { status: 500 }
      );
    }

    // Update system_config.current_model_version
    const { error: configError } = await supabase
      .from('system_config')
      .upsert(
        {
          key: 'current_model_version',
          value: version,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (configError) {
      console.error('Error updating system config:', configError);
      // Don't fail the request, but log the error
    }

    // TODO: Log audit event (Phase 7)

    return NextResponse.json({
      success: true,
      message: `Model version ${version} promoted to active`,
      version,
    });
  } catch (error) {
    console.error('Error promoting model version:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

