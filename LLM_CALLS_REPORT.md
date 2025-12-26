# LLM/AI Model Calls Report

This document identifies ALL places where LLM or AI models are called in the repository.

---

## 🎯 PRIMARY CHAT RESPONSE GENERATOR

### 1. `/Users/josephvaleri/question-my-faith/app/api/ask/route.ts`

**Location:** Lines 66-388  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Next.js API Route)  
**Purpose:** **PRIMARY CHAT RESPONSE GENERATOR** - Main endpoint that generates assistant chat replies

**LLM Calls:**

1. **Line 66-68:** `new OpenAI()` initialization
   ```typescript
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   });
   ```

2. **Lines 226-234:** Assistants API - Retrieve cached assistant
   ```typescript
   await openai.beta.assistants.retrieve(assistantId);
   ```

3. **Line 238:** Assistants API - List assistants
   ```typescript
   const assistants = await openai.beta.assistants.list({ limit: 10 });
   ```

4. **Lines 258-270:** Assistants API - Create assistant with Vector Store (PRIMARY RESPONSE PATH)
   ```typescript
   const assistant = await openai.beta.assistants.create({
     name: assistantName,
     instructions: enhancedSystemPrompt,
     model: "gpt-4o",
     tools: [{ type: "file_search" }],
     tool_resources: {
       file_search: {
         vector_store_ids: [process.env.VECTOR_STORE_ID]
       }
     },
     temperature: 0.7,
     response_format: { type: "text" }
   });
   ```

5. **Lines 298-300:** Threads API - Create thread
   ```typescript
   const thread = await openai.beta.threads.create({
     messages: recentMessages
   });
   ```

6. **Lines 305-331:** Threads API - Stream assistant response (PRIMARY STREAMING)
   ```typescript
   const runStream = openai.beta.threads.runs.createAndStream(thread.id, {
     assistant_id: assistantId,
   });
   // Streams response chunks
   ```

7. **Lines 341-362:** Chat Completions API - Fallback when Assistants API fails
   ```typescript
   const stream = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: input,
     stream: true,
     temperature: 0.7,
     max_tokens: 500,
     presence_penalty: 0.1,
     frequency_penalty: 0.1
   });
   ```

8. **Lines 366-387:** Chat Completions API - Fallback when Vector Store not configured
   ```typescript
   const stream = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: input,
     stream: true,
     temperature: 0.7,
     max_tokens: 500,
     presence_penalty: 0.1,
     frequency_penalty: 0.1
   });
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Line 52, 65)
- `VECTOR_STORE_ID` (Line 60, 149, 203)
- `SYSTEM_PROMPT` (Line 147)
- `OPENAI_CHAT_MODEL` (referenced via chatModel)

**Key Details:**
- Uses Assistants API with Vector Store when `VECTOR_STORE_ID` is configured (primary path)
- Falls back to Chat Completions API if Assistants API fails or Vector Store is not configured
- Streams responses to client
- Model: `gpt-4o` (hardcoded in this file, not using env var)

---

## 🔧 HELPER/UTILITY FUNCTIONS

### 2. `/Users/josephvaleri/question-my-faith/lib/openai.ts`

**Location:** Lines 1-37  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Library module, used by server code)  
**Purpose:** **HELPER** - Utility functions for embeddings and vector store replies

**LLM Calls:**

1. **Line 3:** `new OpenAI()` initialization
   ```typescript
   export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
   ```

2. **Line 9:** Embeddings API - Generate embeddings
   ```typescript
   const res = await openai.embeddings.create({ model: embedModel, input: text });
   ```

3. **Lines 21-34:** Chat Completions API - Reply with Vector Store (NOT CURRENTLY USED)
   ```typescript
   const res = await openai.chat.completions.create({
     model: chatModel,
     messages: [...],
     stream: false
   });
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Line 3)
- `OPENAI_CHAT_MODEL` (Line 5, defaults to 'gpt-4o-mini')
- `OPENAI_EMBED_MODEL` (Line 6, defaults to 'text-embedding-3-small')
- `VECTOR_STORE_ID` (Line 18)
- `SYSTEM_PROMPT` (Line 26)

**Note:** `replyWithVectorStore()` function is defined but not currently used in the codebase.

---

## 🔨 ADMIN/MAINTENANCE ENDPOINTS

### 3. `/Users/josephvaleri/question-my-faith/app/api/retrain-model/route.ts`

**Location:** Lines 55-217  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Next.js API Route)  
**Purpose:** **HELPER/UTILITY** - Admin endpoint for model retraining, uses OpenAI for file operations

**LLM Calls:**

1. **Lines 55-57:** `new OpenAI()` initialization
   ```typescript
   openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   });
   ```

2. **Lines 78-86:** Direct fetch to OpenAI API - Retrieve Vector Store
   ```typescript
   await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
     headers: {
       'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
       'OpenAI-Beta': 'assistants=v2'
     }
   });
   ```

3. **Lines 168-179:** Direct fetch to OpenAI API - List Vector Store files
   ```typescript
   await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreIdForFiles}/files`, {
     headers: {
       'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
       'OpenAI-Beta': 'assistants=v2'
     }
   });
   ```

4. **Line 217:** Files API - Retrieve file details
   ```typescript
   const fileDetails = await openai!.files.retrieve(file.id);
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Lines 54, 82, 176)
- `VECTOR_STORE_ID` (Line 64)

---

### 4. `/Users/josephvaleri/question-my-faith/app/api/check-vector-store/route.ts`

**Location:** Lines 21-88  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Next.js API Route)  
**Purpose:** **HELPER/UTILITY** - Admin endpoint to check Vector Store status

**LLM Calls:**

1. **Lines 21-23:** `new OpenAI()` initialization
   ```typescript
   const openai = new OpenAI({
     apiKey: openaiApiKey
   });
   ```

2. **Lines 26-34:** Direct fetch to OpenAI API - Retrieve Vector Store
   ```typescript
   await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
     headers: {
       'Authorization': `Bearer ${openaiApiKey}`,
       'OpenAI-Beta': 'assistants=v2'
     }
   });
   ```

3. **Lines 48-59:** Direct fetch to OpenAI API - List Vector Store files
   ```typescript
   await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
     headers: {
       'Authorization': `Bearer ${openaiApiKey}`,
       'OpenAI-Beta': 'assistants=v2'
     }
   });
   ```

4. **Line 88:** Files API - Retrieve file details
   ```typescript
   const details = await openai.files.retrieve(file.id);
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Lines 7, 22, 30, 56)
- `VECTOR_STORE_ID` (Line 6)

---

## 📜 SCRIPTS (Server-side only)

### 5. `/Users/josephvaleri/question-my-faith/scripts/create-initial-model.js`

**Location:** Lines 64-69  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Node.js script)  
**Purpose:** **HELPER/UTILITY** - Script to create initial model version

**LLM Calls:**

1. **Lines 64-66:** `new OpenAI()` initialization
   ```javascript
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   });
   ```

2. **Line 69:** Vector Stores API - Retrieve Vector Store
   ```javascript
   const vectorStore = await openai.beta.vectorStores.retrieve(process.env.VECTOR_STORE_ID);
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Lines 61, 65)
- `VECTOR_STORE_ID` (Line 61, 69)

---

### 6. `/Users/josephvaleri/question-my-faith/scripts/upload-jsonl-chunks.js`

**Location:** Lines 9-142  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Node.js script)  
**Purpose:** **HELPER/UTILITY** - Script to upload JSONL chunks to Vector Store

**LLM Calls:**

1. **Lines 9-11:** `new OpenAI()` initialization
   ```javascript
   const openai = new OpenAI({
     apiKey: API_KEY
   });
   ```

2. **Lines 88-91:** Files API - Create file
   ```javascript
   const file = await openai.files.create({
     file: fs.createReadStream(filePath),
     purpose: 'assistants'
   });
   ```

3. **Lines 96-98:** Vector Stores API - Add file to Vector Store
   ```javascript
   const vectorStoreFile = await openai.vectorStores.files.create(VECTOR_STORE_ID, {
     file_id: file.id
   });
   ```

4. **Line 115:** Vector Stores API - Retrieve Vector Store
   ```javascript
   const vectorStore = await openai.vectorStores.retrieve(VECTOR_STORE_ID);
   ```

5. **Line 142:** Vector Stores API - List files
   ```javascript
   const vectorStoreFiles = await openai.vectorStores.files.list(VECTOR_STORE_ID);
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Line 6)
- `VECTOR_STORE_ID` (Line 15, 96, 115, 142)

---

### 7. `/Users/josephvaleri/question-my-faith/scripts/check-vector-store.js`

**Location:** Lines 28-137  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Node.js script)  
**Purpose:** **HELPER/UTILITY** - Script to check Vector Store contents

**LLM Calls:**

1. **Lines 28-30:** `new OpenAI()` initialization
   ```javascript
   const openai = new OpenAI({
     apiKey: openaiApiKey
   });
   ```

2. **Line 38:** Vector Stores API - Retrieve Vector Store
   ```javascript
   const vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreId);
   ```

3. **Lines 69-73:** Vector Stores API - List files
   ```javascript
   const fileList = await openai.beta.vectorStores.files.list({
     vector_store_id: vectorStoreId,
     limit: 100,
     ...(cursor && { after: cursor })
   });
   ```

4. **Line 137:** Files API - Retrieve file details
   ```javascript
   const fileDetails = await openai.files.retrieve(file.id);
   ```

**Environment Variables Used:**
- `OPENAI_API_KEY` (Line 14, 29)
- `VECTOR_STORE_ID` (Line 13, 38, 70)

---

### 8. `/Users/josephvaleri/question-my-faith/scripts/test-openai.js`

**Location:** Lines 4-18  
**Server-side or Client-side:** ✅ **SERVER-SIDE** (Node.js test script)  
**Purpose:** **HELPER/UTILITY** - Test script to verify OpenAI SDK setup

**LLM Calls:**

1. **Lines 8-10:** `new OpenAI()` initialization
   ```javascript
   const client = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY || ''
   });
   ```

**Note:** This is a test script that doesn't make actual API calls, just tests the SDK setup.

**Environment Variables Used:**
- `OPENAI_API_KEY` (Line 9)

---

## 📋 SUMMARY

### PRIMARY CHAT RESPONSE GENERATOR
- **`/app/api/ask/route.ts`** - This is the ONLY file that generates assistant chat replies to users
  - Uses Assistants API with Vector Store (primary path)
  - Falls back to Chat Completions API when needed
  - All responses are streamed to the client

### HELPER/UTILITY FUNCTIONS
- **`/lib/openai.ts`** - Embeddings and utility functions (one unused function)
- **`/app/api/retrain-model/route.ts`** - Model retraining endpoint
- **`/app/api/check-vector-store/route.ts`** - Vector Store status checker

### ADMIN SCRIPTS
- **`/scripts/create-initial-model.js`** - Creates initial model version
- **`/scripts/upload-jsonl-chunks.js`** - Uploads training data to Vector Store
- **`/scripts/check-vector-store.js`** - Checks Vector Store contents
- **`/scripts/test-openai.js`** - Tests OpenAI SDK setup

### KEY OBSERVATIONS

1. **ALL LLM calls are SERVER-SIDE** - No client-side OpenAI calls detected
2. **Single source of truth for chat responses:** `/app/api/ask/route.ts`
3. **Primary model:** `gpt-4o` (hardcoded in ask route, not using env var `OPENAI_CHAT_MODEL`)
4. **Vector Store integration:** Uses Assistants API with file_search tool when Vector Store is configured
5. **Fallback mechanism:** Falls back to standard Chat Completions API if Assistants API fails
6. **Environment variables:**
   - `OPENAI_API_KEY` - Used in all files
   - `VECTOR_STORE_ID` - Used when Vector Store features are needed
   - `OPENAI_CHAT_MODEL` - Defined but not used in primary chat route (hardcoded `gpt-4o` instead)
   - `OPENAI_EMBED_MODEL` - Used in embeddings function
   - `SYSTEM_PROMPT` - Used for system prompts

### NO CLIENT-SIDE LLM CALLS FOUND
All LLM calls are made from:
- Next.js API routes (server-side)
- Node.js scripts (server-side)
- Library modules (imported by server-side code)

The client-side code (`/app/(site)/useAsk.ts`) only makes HTTP requests to `/api/ask`, it does not directly call OpenAI.

