import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = supaServer();
    
    // Get all model versions
    const { data: allVersions, error: fetchError } = await supabase
      .from('model_versions')
      .select('id, version, status, created_at')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      return NextResponse.json({ 
        error: 'Failed to fetch model versions',
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!allVersions || allVersions.length === 0) {
      return NextResponse.json({ 
        error: 'No model versions found' 
      }, { status: 404 });
    }
    
    // Find the most recent version (should be active)
    const mostRecent = allVersions[0];
    const activeVersions = allVersions.filter(v => v.status === 'active');
    const otherVersions = allVersions.filter(v => v.id !== mostRecent.id);
    
    // Update: Set all versions except the most recent to inactive
    const updates: any[] = [];
    
    for (const version of otherVersions) {
      if (version.status !== 'inactive') {
        updates.push({
          id: version.id,
          version: version.version,
          oldStatus: version.status,
          newStatus: 'inactive'
        });
        
        const { error } = await supabase
          .from('model_versions')
          .update({ status: 'inactive' })
          .eq('id', version.id);
        
        if (error) {
          console.error(`Error updating version ${version.version}:`, error);
        }
      }
    }
    
    // Set the most recent version to active
    if (mostRecent.status !== 'active') {
      const { error } = await supabase
        .from('model_versions')
        .update({ status: 'active' })
        .eq('id', mostRecent.id);
      
      if (error) {
        return NextResponse.json({ 
          error: 'Failed to activate most recent model',
          details: error.message 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Model statuses updated',
      changes: {
        activated: {
          version: mostRecent.version,
          id: mostRecent.id,
          previousStatus: mostRecent.status
        },
        deactivated: updates
      },
      summary: {
        totalVersions: allVersions.length,
        nowActive: mostRecent.version,
        deactivatedCount: updates.length
      }
    });
    
  } catch (error) {
    console.error('Error fixing model status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

