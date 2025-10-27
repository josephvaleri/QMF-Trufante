const OpenAI = require('openai').default;
const fs = require('fs');
const path = require('path');

// Load API key from environment variable
const API_KEY = process.env.OPENAI_API_KEY || '';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: API_KEY
});

async function createVectorStore() {
  try {
    console.log('🚀 Creating new vector store...');
    
    const vectorStore = await openai.vectorStores.create({
      name: 'Question My Faith Knowledge Base',
      description: 'Vector store containing faith and spirituality guidance, business processes, and training materials for Question My Faith application'
    });
    
    console.log('✅ Vector store created successfully!');
    console.log('📋 Vector Store Details:');
    console.log('   ID:', vectorStore.id);
    console.log('   Name:', vectorStore.name);
    console.log('   Status:', vectorStore.status);
    console.log('   Created:', new Date(vectorStore.created_at * 1000).toLocaleString());
    
    // Update .env.local file
    updateEnvFile(vectorStore.id);
    
    return vectorStore;
    
  } catch (error) {
    console.error('❌ Error creating vector store:', error.message);
    throw error;
  }
}

function updateEnvFile(vectorStoreId) {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add VECTOR_STORE_ID
  const vectorStoreLine = `VECTOR_STORE_ID=${vectorStoreId}`;
  
  if (envContent.includes('VECTOR_STORE_ID=')) {
    envContent = envContent.replace(/VECTOR_STORE_ID=.*/, vectorStoreLine);
    console.log('📝 Updated VECTOR_STORE_ID in .env.local');
  } else {
    envContent += `\n${vectorStoreLine}\n`;
    console.log('📝 Added VECTOR_STORE_ID to .env.local');
  }
  
  // Also update the API key
  const apiKeyLine = `OPENAI_API_KEY=${API_KEY}`;
  if (envContent.includes('OPENAI_API_KEY=')) {
    envContent = envContent.replace(/OPENAI_API_KEY=.*/, apiKeyLine);
    console.log('📝 Updated OPENAI_API_KEY in .env.local');
  } else {
    envContent += `\n${apiKeyLine}\n`;
    console.log('📝 Added OPENAI_API_KEY to .env.local');
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Environment variables updated successfully!');
}

async function uploadDocument(filePath, fileName) {
  try {
    console.log(`📄 Uploading ${fileName}...`);
    
    const fileContent = fs.readFileSync(filePath);
    const file = await openai.files.create({
      file: fileContent,
      purpose: 'assistants'
    });
    
    console.log(`✅ File uploaded: ${file.id}`);
    return file;
    
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    throw error;
  }
}

async function addFileToVectorStore(vectorStoreId, fileId) {
  try {
    const vectorStoreFile = await openai.vectorStores.files.create(vectorStoreId, {
      file_id: fileId
    });
    
    console.log(`✅ File added to vector store: ${vectorStoreFile.id}`);
    return vectorStoreFile;
    
  } catch (error) {
    console.error('❌ Error adding file to vector store:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Create vector store
    const vectorStore = await createVectorStore();
    
    // Check for documents to upload
    const docsDir = path.join(__dirname, 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
      console.log('\n📁 Created documents directory at:', docsDir);
      console.log('📋 Please add your documents to the documents/ folder and run this script again to upload them');
      return;
    }
    
    const files = fs.readdirSync(docsDir);
    const supportedFormats = ['.txt', '.md', '.pdf', '.docx', '.html'];
    const documentFiles = files.filter(file => 
      supportedFormats.some(format => file.toLowerCase().endsWith(format))
    );
    
    if (documentFiles.length === 0) {
      console.log('\n📁 No documents found in documents/ folder');
      console.log('Supported formats:', supportedFormats.join(', '));
      console.log('Please add your documents and run this script again');
      return;
    }
    
    console.log(`\n📄 Found ${documentFiles.length} document(s) to upload:`);
    documentFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
    // Upload documents
    const uploadedFiles = [];
    for (const fileName of documentFiles) {
      const filePath = path.join(docsDir, fileName);
      const file = await uploadDocument(filePath, fileName);
      const vectorStoreFile = await addFileToVectorStore(vectorStore.id, file.id);
      uploadedFiles.push({ fileName, fileId: file.id, vectorStoreFileId: vectorStoreFile.id });
    }
    
    console.log('\n⏳ Waiting for files to be processed...');
    console.log('This may take a few minutes depending on file size...');
    
    // Monitor processing status
    let allProcessed = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (!allProcessed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      try {
        const vectorStoreFiles = await openai.vectorStores.files.list(vectorStore.id);
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
    
    console.log('\n🎉 Vector store setup complete!');
    console.log('📋 Next steps:');
    console.log('   1. Your vector store is ready to use');
    console.log('   2. The API will now query the vector store for relevant context');
    console.log('   3. Test the chat functionality to see RAG in action');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main();
