const OpenAI = require('openai').default;
const fs = require('fs');
const path = require('path');

// Load API key from environment variable
const API_KEY = process.env.OPENAI_API_KEY || '';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: API_KEY
});

// Load environment variables
require('dotenv').config({ path: '.env.local' });
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

if (!VECTOR_STORE_ID) {
  console.error('❌ VECTOR_STORE_ID not found in .env.local');
  console.log('Please run npm run setup-vector-store first');
  process.exit(1);
}

async function parseJSONLFile(filePath) {
  try {
    console.log(`📄 Parsing JSONL file: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const chunks = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const chunk = JSON.parse(lines[i]);
        chunks.push({
          input: chunk.input,
          metadata: chunk.metadata,
          lineNumber: i + 1
        });
      } catch (parseError) {
        console.warn(`⚠️ Skipping malformed JSON on line ${i + 1}:`, parseError.message);
      }
    }
    
    console.log(`✅ Parsed ${chunks.length} chunks from JSONL file`);
    return chunks;
    
  } catch (error) {
    console.error('❌ Error parsing JSONL file:', error.message);
    throw error;
  }
}

async function createTextFileFromChunk(chunk, index) {
  try {
    // Create a text file for each chunk
    const fileName = `qmf_chunk_${index + 1}_${chunk.metadata.section?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'}.txt`;
    const filePath = path.join(__dirname, 'temp_chunks', fileName);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, 'temp_chunks');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create content with metadata header
    const content = `# ${chunk.metadata.section || 'QMF Content'}\n\n${chunk.input}`;
    
    fs.writeFileSync(filePath, content);
    return { filePath, fileName };
    
  } catch (error) {
    console.error(`❌ Error creating text file for chunk ${index + 1}:`, error.message);
    throw error;
  }
}

async function uploadChunkToVectorStore(chunk, index) {
  try {
    console.log(`📤 Uploading chunk ${index + 1}: ${chunk.metadata.section || 'Unknown section'}`);
    
    // Create text file from chunk
    const { filePath, fileName } = await createTextFileFromChunk(chunk, index);
    
    // Read the file content as a buffer
    const fileContent = fs.readFileSync(filePath);
    
    // Upload to OpenAI using the file path directly
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: 'assistants'
    });
    
    console.log(`✅ File uploaded: ${file.id} (${fileName})`);
    
    // Add to vector store
    const vectorStoreFile = await openai.vectorStores.files.create(VECTOR_STORE_ID, {
      file_id: file.id
    });
    
    console.log(`✅ Added to vector store: ${vectorStoreFile.id}`);
    
    // Clean up temp file
    fs.unlinkSync(filePath);
    
    return { file, vectorStoreFile };
    
  } catch (error) {
    console.error(`❌ Error uploading chunk ${index + 1}:`, error.message);
    throw error;
  }
}

async function checkVectorStoreStatus() {
  try {
    const vectorStore = await openai.vectorStores.retrieve(VECTOR_STORE_ID);
    console.log('\n📊 Current Vector Store Status:');
    console.log('   ID:', vectorStore.id);
    console.log('   Name:', vectorStore.name);
    console.log('   Status:', vectorStore.status);
    console.log('   File Count:', vectorStore.file_counts?.total || 0);
    console.log('   Usage Bytes:', vectorStore.usage_bytes || 0);
    
    return vectorStore;
  } catch (error) {
    console.error('❌ Error checking vector store status:', error.message);
    throw error;
  }
}

async function monitorProcessing() {
  console.log('\n⏳ Monitoring file processing...');
  
  let allProcessed = false;
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (!allProcessed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    attempts++;
    
    try {
      const vectorStoreFiles = await openai.vectorStores.files.list(VECTOR_STORE_ID);
      const processingFiles = vectorStoreFiles.data.filter(file => file.status === 'in_progress');
      
      if (processingFiles.length === 0) {
        allProcessed = true;
        console.log('✅ All files processed successfully!');
      } else {
        console.log(`⏳ ${processingFiles.length} file(s) still processing...`);
      }
    } catch (error) {
      console.warn('Error checking processing status:', error.message);
    }
  }
  
  if (!allProcessed) {
    console.log('⚠️ Some files may still be processing. Check the OpenAI dashboard for final status.');
  }
}

async function main() {
  try {
    console.log('🚀 Starting QMF JSONL chunks upload...');
    
    // Check vector store status
    await checkVectorStoreStatus();
    
    // Parse the JSONL file
    const jsonlPath = path.join('/Users/josephvaleri/Downloads', 'QMF_Prompt_JV_vB_chunks (1).jsonl');
    if (!fs.existsSync(jsonlPath)) {
      console.error('❌ JSONL file not found at:', jsonlPath);
      console.log('Please ensure the file is in the Downloads folder');
      process.exit(1);
    }
    
    const chunks = await parseJSONLFile(jsonlPath);
    
    if (chunks.length === 0) {
      console.log('❌ No chunks found in JSONL file');
      process.exit(1);
    }
    
    console.log(`\n📋 Found ${chunks.length} chunks to upload:`);
    chunks.forEach((chunk, index) => {
      console.log(`   ${index + 1}. ${chunk.metadata.section || 'Unknown'} (${chunk.input.length} chars)`);
    });
    
    // Upload each chunk
    const uploadedFiles = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const result = await uploadChunkToVectorStore(chunk, i);
        uploadedFiles.push({
          chunkIndex: i + 1,
          section: chunk.metadata.section,
          fileId: result.file.id,
          vectorStoreFileId: result.vectorStoreFile.id
        });
      } catch (error) {
        console.error(`Failed to upload chunk ${i + 1}, continuing with others...`);
      }
    }
    
    console.log(`\n✅ Successfully uploaded ${uploadedFiles.length} chunks`);
    
    // Monitor processing
    await monitorProcessing();
    
    // Clean up temp directory
    const tempDir = path.join(__dirname, 'temp_chunks');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up temporary files');
    }
    
    // Final status check
    await checkVectorStoreStatus();
    
    console.log('\n🎉 QMF chunks upload complete!');
    console.log('📋 Your vector store now contains:');
    console.log('   - QMF Personality & Response Framework');
    console.log('   - Conversational guidelines and principles');
    console.log('   - Empathic techniques and guardrails');
    console.log('   - Theological alignment and interaction patterns');
    
    console.log('\n✨ The chat API will now use this rich context for more accurate responses!');
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run the upload
main();
