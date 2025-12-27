import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireModerator } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireModerator(request);
    const vectorStoreId = process.env.VECTOR_STORE_ID;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!vectorStoreId) {
      return NextResponse.json({ 
        error: 'VECTOR_STORE_ID not configured' 
      }, { status: 400 });
    }

    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY not configured' 
      }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Retrieve vector store information using REST API
    const vectorStoreResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    
    if (!vectorStoreResponse.ok) {
      throw new Error(`Failed to retrieve vector store: ${vectorStoreResponse.statusText}`);
    }
    
    const vectorStore = await vectorStoreResponse.json();
    
    // List files in the vector store using REST API
    let allFiles: any[] = [];
    let hasMore = true;
    let after: string | null = null;

    while (hasMore) {
      const url = new URL(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`);
      url.searchParams.append('limit', '100');
      if (after) {
        url.searchParams.append('after', after);
      }
      
      const fileListResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!fileListResponse.ok) {
        throw new Error(`Failed to list files: ${fileListResponse.statusText}`);
      }
      
      const fileList = await fileListResponse.json();

      if (fileList.data) {
        allFiles = allFiles.concat(fileList.data);
      }
      
      hasMore = fileList.has_more || false;
      if (fileList.last_id) {
        after = fileList.last_id;
      } else {
        hasMore = false;
      }

      if (!fileList.has_more || (fileList.data && fileList.data.length < 100)) {
        hasMore = false;
      }
    }

    // Get file details for first 10 files
    const fileDetails = [];
    for (let i = 0; i < Math.min(10, allFiles.length); i++) {
      const file = allFiles[i];
      try {
        const details = await openai.files.retrieve(file.id);
        fileDetails.push({
          id: file.id,
          filename: details.filename,
          size_bytes: details.bytes,
          size_kb: (details.bytes / 1024).toFixed(2),
          purpose: details.purpose,
          created_at: new Date(details.created_at * 1000).toISOString(),
          status: file.status,
          chunking_strategy: file.chunking_strategy,
          last_error: file.last_error
        });
      } catch (error) {
        fileDetails.push({
          id: file.id,
          status: file.status,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Summary by status
    const statusCounts = allFiles.reduce((acc: any, file: any) => {
      acc[file.status] = (acc[file.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      vectorStore: {
        id: vectorStore.id,
        name: vectorStore.name || 'Unnamed',
        status: vectorStore.status,
        created_at: new Date(vectorStore.created_at * 1000).toISOString(),
        usage_bytes: vectorStore.usage_bytes,
        usage_mb: (vectorStore.usage_bytes / 1024 / 1024).toFixed(2),
        file_counts: vectorStore.file_counts
      },
      files: {
        total: allFiles.length,
        status_counts: statusCounts,
        details: fileDetails,
        all_files: allFiles.map((f: any) => ({
          id: f.id,
          status: f.status,
          created_at: new Date(f.created_at * 1000).toISOString(),
          chunking_strategy: f.chunking_strategy,
          last_error: f.last_error
        }))
      }
    });

  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error('Error checking Vector Store:', error);
    return NextResponse.json({ 
      error: 'Failed to check Vector Store',
      details: error.message || 'Unknown error',
      code: error.code,
      status: error.status
    }, { status: 500 });
  }
}

