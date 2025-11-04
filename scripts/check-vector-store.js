#!/usr/bin/env node

/**
 * Script to check the contents of the OpenAI Vector Store
 * Lists all files and their status in the vector store
 */

const OpenAI = require('openai');
require('dotenv').config();

async function checkVectorStore() {
  // Allow Vector Store ID to be passed as command line argument or from env
  const vectorStoreId = process.argv[2] || process.env.VECTOR_STORE_ID;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!vectorStoreId) {
    console.error('❌ VECTOR_STORE_ID not set');
    console.error('   Usage: node scripts/check-vector-store.js [VECTOR_STORE_ID]');
    console.error('   Or set VECTOR_STORE_ID in environment variables');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY not set in environment variables');
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey
  });

  try {
    console.log('=== Vector Store Contents ===\n');
    console.log(`Vector Store ID: ${vectorStoreId}\n`);

    // Retrieve vector store information
    console.log('1. Retrieving Vector Store information...');
    const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
    
    console.log('✅ Vector Store Details:');
    console.log(`   Name: ${vectorStore.name || 'Unnamed'}`);
    console.log(`   Status: ${vectorStore.status}`);
    console.log(`   Created: ${new Date(vectorStore.created_at * 1000).toLocaleString()}`);
    console.log(`   Usage: ${(vectorStore.usage_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // File counts
    if (vectorStore.file_counts) {
      console.log('📊 File Counts:');
      console.log(`   Completed: ${vectorStore.file_counts.completed || 0}`);
      console.log(`   In Progress: ${vectorStore.file_counts.in_progress || 0}`);
      console.log(`   Failed: ${vectorStore.file_counts.failed || 0}`);
      console.log();
    }

    // List files in the vector store
    console.log('2. Listing files in Vector Store...');
    
    let allFiles = [];
    let hasMore = true;
    let cursor = null;

    while (hasMore) {
      const params = { vector_store_id: vectorStoreId };
      if (cursor) {
        params.after = cursor;
      }
      
      const fileList = await openai.beta.vectorStores.files.list({
        vector_store_id: vectorStoreId,
        limit: 100,
        ...(cursor && { after: cursor })
      });

      allFiles = allFiles.concat(fileList.data || []);
      
      hasMore = fileList.has_more || false;
      if (fileList.last_id) {
        cursor = fileList.last_id;
      } else {
        hasMore = false;
      }

      // Break if we got fewer than 100 results (likely last page)
      if (!fileList.has_more || (fileList.data && fileList.data.length < 100)) {
        hasMore = false;
      }
    }

    console.log(`✅ Found ${allFiles.length} file(s) in Vector Store\n`);

    if (allFiles.length === 0) {
      console.log('⚠️  No files found in Vector Store');
      console.log('   This might mean:');
      console.log('   - Files are still being processed');
      console.log('   - Files failed to upload');
      console.log('   - Vector Store is empty');
    } else {
      console.log('📄 Files:');
      console.log('─'.repeat(80));
      
      allFiles.forEach((file, index) => {
        console.log(`\n${index + 1}. File ID: ${file.id}`);
        console.log(`   Status: ${file.status}`);
        console.log(`   Created: ${new Date(file.created_at * 1000).toLocaleString()}`);
        
        if (file.chunking_strategy) {
          console.log(`   Chunking: ${JSON.stringify(file.chunking_strategy)}`);
        }
        
        if (file.last_error) {
          console.log(`   ⚠️  Error: ${file.last_error.message || file.last_error}`);
        }
      });
      
      console.log('\n' + '─'.repeat(80));
      
      // Summary by status
      const statusCounts = allFiles.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n📊 Summary by Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }

    // Get file details (first few files)
    if (allFiles.length > 0) {
      console.log('\n3. Retrieving file details (first 5 files)...');
      
      for (let i = 0; i < Math.min(5, allFiles.length); i++) {
        const file = allFiles[i];
        try {
          const fileDetails = await openai.files.retrieve(file.id);
          console.log(`\n   File ${i + 1}: ${fileDetails.filename || 'Unknown'}`);
          console.log(`   Size: ${(fileDetails.bytes / 1024).toFixed(2)} KB`);
          console.log(`   Purpose: ${fileDetails.purpose}`);
          console.log(`   Created: ${new Date(fileDetails.created_at * 1000).toLocaleString()}`);
        } catch (error) {
          console.log(`   File ${i + 1}: Could not retrieve details (${error.message})`);
        }
      }
    }

    console.log('\n=== End of Vector Store Contents ===\n');

  } catch (error) {
    console.error('❌ Error checking Vector Store:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (error.status) {
      console.error(`   HTTP Status: ${error.status}`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the script
checkVectorStore();

