import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const supabase = supaServer();

    // TODO: Add auth/role check (Security Task 1)

    // Query vector_store_files for files to clean up
    // Files where is_active = false OR model_version is inactive AND file not referenced by any active version
    const { data: inactiveFiles, error: inactiveError } = await supabase
      .from('vector_store_files')
      .select('*')
      .eq('is_active', false);

    // Get files with model versions
    const { data: filesWithVersions, error: filesError } = await supabase
      .from('vector_store_files')
      .select('*, model_version')
      .not('model_version', 'is', null);

    // Filter to only files where model_version status is inactive
    let inactiveVersionFiles: any[] = [];
    if (filesWithVersions && filesWithVersions.length > 0) {
      const versionStrings = [...new Set(filesWithVersions.map(f => f.model_version).filter(Boolean))];
      if (versionStrings.length > 0) {
        const { data: versions } = await supabase
          .from('model_versions')
          .select('version, status')
          .in('version', versionStrings);

        const inactiveVersions = new Set(
          versions?.filter(v => v.status === 'inactive').map(v => v.version) || []
        );

        inactiveVersionFiles = filesWithVersions.filter(
          f => f.model_version && inactiveVersions.has(f.model_version)
        );
      }
    }

    // Combine files to clean up
    const filesToCleanup = [
      ...(inactiveFiles || []),
      ...inactiveVersionFiles,
    ];

    // Remove duplicates by file_id
    const uniqueFiles = Array.from(
      new Map(filesToCleanup.map(f => [f.file_id, f])).values()
    );

    console.log(`Found ${uniqueFiles.length} files to clean up`);

    const cleanupResults = {
      deleted_from_vector_store: 0,
      deleted_from_openai: 0,
      errors: [] as string[],
    };

    // For each file, delete from vector store and OpenAI
    for (const file of uniqueFiles) {
      try {
        // Delete from vector store using REST API (vectorStores.files.delete may not be in TypeScript types)
        try {
          const deleteResponse = await fetch(
            `https://api.openai.com/v1/vector_stores/${file.vector_store_id}/files/${file.file_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
              },
            }
          );

          if (deleteResponse.ok) {
            cleanupResults.deleted_from_vector_store++;
          } else {
            throw new Error(`Delete failed with status ${deleteResponse.status}`);
          }
        } catch (error) {
          console.warn(`Error deleting ${file.file_id} from vector store:`, error);
          cleanupResults.errors.push(`Vector store deletion failed for ${file.file_id}`);
        }

        // Delete from OpenAI files API
        try {
          await openai.files.del(file.file_id);
          cleanupResults.deleted_from_openai++;
        } catch (error) {
          console.warn(`Error deleting ${file.file_id} from OpenAI:`, error);
          cleanupResults.errors.push(`OpenAI file deletion failed for ${file.file_id}`);
        }

        // Mark as deleted in DB (soft delete - remove row)
        await supabase
          .from('vector_store_files')
          .delete()
          .eq('id', file.id);
      } catch (error) {
        console.error(`Error processing cleanup for file ${file.file_id}:`, error);
        cleanupResults.errors.push(`Cleanup failed for ${file.file_id}`);
      }
    }

    return NextResponse.json({
      success: true,
      files_processed: uniqueFiles.length,
      ...cleanupResults,
    });
  } catch (error) {
    console.error('Error in vector store cleanup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

