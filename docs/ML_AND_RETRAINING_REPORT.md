# ML and Retraining Report

## 1. Executive Summary

- **"Retraining" is NOT true model fine-tuning** - No OpenAI fine-tuning API calls exist in the codebase (confirmed by searching for "fine_tune", "fine-tune", "fine_tuning", and "jobs.create")
- **"Retraining" is metadata versioning** - The system creates new `model_versions` rows in the database that track which moderated Q&A pairs and Vector Store files were used as training data sources
- **No actual model weights are changed** - The system continues using the same base OpenAI models (`gpt-4o`) with the same Assistants API or Chat Completions API
- **Primary mechanism is RAG (Retrieval Augmented Generation)** - Vector Store with `file_search` tool provides knowledge base retrieval at runtime
- **System prompt updates ARE applied** - When `SYSTEM_PROMPT` env var changes, assistant instructions are updated via `openai.beta.assistants.update()` (lines 278, 331 in `app/api/ask/route.ts`)
- **Retraining endpoint** (`/api/retrain-model`) creates metadata records and optionally lists Vector Store files, but does not modify OpenAI model weights
- **Moderation workflow** - Content flagged in `moderation_queue` is reviewed via UI at `/moderation`, and "accepted"/"edited" items feed into `qna_accepted` view used by retraining
- **Automatic retraining trigger** - When moderation queue reaches threshold (default 20 accepted/edited items), `/api/retrain-model` is called asynchronously
- **Training data storage** - Accepted Q&A pairs are stored in `model_training_data` table with metadata, but this table is not used at runtime
- **Vector Store is shared/global** - Single `VECTOR_STORE_ID` env var used for all requests; files are uploaded via scripts, not per-user
- **Model version selection** - `system_config.current_model_version` is read but only affects logging/metadata, not which assistant or model is used
- **Temperature fixed at 0.3** - Hardcoded in `app/api/ask/route.ts` lines 360, 458, 485 (down from 0.7 in earlier versions)
- **History window limited** - Only last 3 messages sent to Assistants API (line 396 in `app/api/ask/route.ts`), full history used for Chat Completions fallback
- **Primary levers for output behavior:**
  1. `SYSTEM_PROMPT` env var (affects assistant instructions)
  2. Vector Store contents (via `file_search` tool)
  3. Temperature (0.3, hardcoded)
  4. Message history window (3 messages for Assistants API)
  5. Model selection (`gpt-4o`, hardcoded, not using `OPENAI_CHAT_MODEL` env var)

---

## 2. System Diagram (Text)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ POST /api/ask
       │ {question, history, session_id}
       ▼
┌─────────────────────────────────────┐
│  app/api/ask/route.ts               │
│  - Crisis detection                 │
│  - Moderation check                 │
│  - Get model_version (metadata)     │
│  - Build enhancedSystemPrompt       │
└──────┬──────────────────────────────┘
       │
       ├─→ VECTOR_STORE_ID exists?
       │   │
       │   YES ───────────────────────────────┐
       │   │                                   │
       │   ▼                                   │
       │   ┌──────────────────────────────┐   │
       │   │ Assistants API Path          │   │
       │   │ 1. Get/cache assistant_id    │   │
       │   │    (system_config table)     │   │
       │   │ 2. Update instructions if    │   │
       │   │    SYSTEM_PROMPT changed     │   │
       │   │ 3. openai.beta.threads.create│   │
       │   │ 4. openai.beta.threads.runs  │   │
       │   │    .createAndStream()        │   │
       │   │    (uses file_search tool)   │   │
       │   └──────────┬───────────────────┘   │
       │              │                        │
       │              └──→ Stream response     │
       │                                       │
       │   NO ─────────────────────────────────┘
       │   │
       │   ▼
       │   ┌──────────────────────────────┐
       │   │ Chat Completions API         │
       │   │ openai.chat.completions.create│
       │   │ (no Vector Store)            │
       │   └──────────┬───────────────────┘
       │              │
       │              └──→ Stream response
       │
       ▼
┌─────────────────────────────────────┐
│  Save to Database                   │
│  - qna table (user_id, question,    │
│    assistant_answer)                │
│  - chat_messages (if session_id)    │
│  - model_performance (metrics)      │
│  - moderation_queue (auto-insert)   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Moderation Queue                   │
│  (status: 'pending')                │
│                                     │
│  Moderator reviews via              │
│  /moderation page                   │
│  - Accept / Deny / Edit             │
│  - POST /api/moderation/[action]    │
└──────┬──────────────────────────────┘
       │
       │ If accepted/edited
       ▼
┌─────────────────────────────────────┐
│  qna_accepted view                  │
│  (SQL view joining qna +            │
│   moderation_queue)                 │
└──────┬──────────────────────────────┘
       │
       │ When threshold reached (20 items)
       ▼
┌─────────────────────────────────────┐
│  POST /api/retrain-model            │
│  - Fetch from qna_accepted          │
│  - Store in model_training_data     │
│  - Create model_versions row        │
│  - Update system_config             │
│  - (NO actual model fine-tuning)    │
└─────────────────────────────────────┘
```

**Vector Store Upload Flow:**
```
┌─────────────────────┐
│ JSONL Files / Docs  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ scripts/upload-     │
│ jsonl-chunks.js     │
│ - Parse chunks      │
│ - openai.files.create│
│ - openai.vectorStores│
│   .files.create()   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ OpenAI Vector Store │
│ (VECTOR_STORE_ID)   │
│ - Files processed   │
│ - Embedded & indexed│
└──────┬──────────────┘
       │
       │ Used at runtime via
       │ file_search tool
       ▼
┌─────────────────────┐
│ Assistants API      │
│ (file_search)       │
└─────────────────────┘
```

---

## 3. All AI/LLM Touchpoints

| File Path | Function / Route | Model/API Used | Purpose | Inputs/Outputs | Env Vars Used | Line Numbers |
|-----------|------------------|----------------|---------|----------------|---------------|--------------|
| `app/api/ask/route.ts` | `POST /api/ask` | Assistants API v2 (`beta.assistants`, `beta.threads`) | **PRIMARY CHAT RESPONSE** - Generates assistant replies with Vector Store | Input: `{question, history, session_id}`<br>Output: Streamed SSE response | `OPENAI_API_KEY`, `VECTOR_STORE_ID`, `SYSTEM_PROMPT`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lines 86-88 (init), 226-234 (retrieve), 238 (list), 258-270 (create), 278-280 (update), 298-300 (thread create), 305-331 (stream) |
| `app/api/ask/route.ts` | `POST /api/ask` (fallback) | Chat Completions API (`chat.completions.create`) | **FALLBACK** - When Assistants API fails or Vector Store not configured | Input: `messages[]` array<br>Output: Streamed response chunks | `OPENAI_API_KEY`, `SYSTEM_PROMPT` | Lines 454-477 (fallback), 481-504 (no Vector Store path) |
| `lib/openai.ts` | `embed()` | Embeddings API (`embeddings.create`) | Generate embeddings for text (NOT CURRENTLY USED in main flow) | Input: `text: string`<br>Output: `number[]` (embedding vector) | `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL` (defaults to 'text-embedding-3-small') | Lines 8-11 |
| `lib/openai.ts` | `replyWithVectorStore()` | Chat Completions API | Helper function (NOT CURRENTLY USED) | Input: `userContent: string`<br>Output: `string` (response) | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `VECTOR_STORE_ID`, `SYSTEM_PROMPT` | Lines 17-36 |
| `app/api/retrain-model/route.ts` | `POST /api/retrain-model` | Files API (`files.retrieve`), REST API (`/v1/vector_stores/*`) | **ADMIN** - Lists Vector Store files for metadata tracking | Input: `{isInitialBuild?}`<br>Output: JSON with model version info | `OPENAI_API_KEY`, `VECTOR_STORE_ID` | Lines 55-57 (init), 78-86 (REST fetch), 168-179 (REST fetch files), 217 (files.retrieve) |
| `app/api/check-vector-store/route.ts` | `GET /api/check-vector-store` | Files API (`files.retrieve`), REST API (`/v1/vector_stores/*`) | **ADMIN** - Check Vector Store status and file list | Input: None<br>Output: JSON with Vector Store details | `OPENAI_API_KEY`, `VECTOR_STORE_ID` | Lines 21-23 (init), 26-34 (REST fetch), 48-59 (REST fetch files), 88 (files.retrieve) |
| `scripts/create-initial-model.js` | Node.js script | Vector Stores API (`beta.vectorStores.retrieve`) | **ADMIN SCRIPT** - Create initial model version metadata | Input: None (reads env)<br>Output: Console logs | `OPENAI_API_KEY`, `VECTOR_STORE_ID` | Lines 64-66 (init), 69 (retrieve) |
| `scripts/upload-jsonl-chunks.js` | Node.js script | Files API (`files.create`), Vector Stores API (`vectorStores.files.create`, `vectorStores.retrieve`, `vectorStores.files.list`) | **ADMIN SCRIPT** - Upload training data to Vector Store | Input: JSONL file path<br>Output: Console logs | `OPENAI_API_KEY`, `VECTOR_STORE_ID` | Lines 9-11 (init), 88-91 (files.create), 96-98 (files.create), 115 (retrieve), 142 (list) |
| `scripts/check-vector-store.js` | Node.js script | Vector Stores API (`beta.vectorStores.retrieve`, `beta.vectorStores.files.list`), Files API (`files.retrieve`) | **ADMIN SCRIPT** - Check Vector Store contents | Input: Optional vectorStoreId arg<br>Output: Console logs | `OPENAI_API_KEY`, `VECTOR_STORE_ID` | Lines 28-30 (init), 38 (retrieve), 69-73 (list), 137 (files.retrieve) |
| `scripts/test-openai.js` | Node.js script | None (test script only) | **TEST** - Verify OpenAI SDK setup | Input: None<br>Output: Console logs | `OPENAI_API_KEY` | Lines 8-10 (init only, no API calls) |

**Note:** No fine-tuning API calls found. Searched for: "fine_tune", "fine-tune", "fine_tuning", "jobs.create" - no matches in actual API usage.

---

## 4. "Retraining" Endpoints and Scripts

### 4.1 `app/api/retrain-model/route.ts`

**Trigger Method:**
- Automatic: Called asynchronously from `/api/moderation/[action]` when threshold reached (line 145 in `app/api/moderation/[action]/route.ts`)
- Manual: Can be called via `POST /api/retrain-model` with optional `{isInitialBuild: true}` body
- Protection: None - endpoint is not protected (should be added)

**Step-by-Step Process:**

1. **Fetch Accepted Q&A Pairs** (lines 24-48)
   - Queries `qna_accepted` view (SQL view joining `qna` + `moderation_queue`)
   - Filters for `status IN ('accepted', 'edited')`
   - Orders by `created_at ASC`

2. **Initialize OpenAI Client** (lines 54-60)
   - Creates OpenAI client if `OPENAI_API_KEY` exists

3. **Retrieve Vector Store Metadata** (lines 73-140)
   - If `VECTOR_STORE_ID` exists, fetches Vector Store info via REST API: `GET https://api.openai.com/v1/vector_stores/{id}`
   - Lists all files via REST API: `GET https://api.openai.com/v1/vector_stores/{id}/files`
   - Retrieves file details using `openai.files.retrieve()` for metadata

4. **Create Training Data Records** (lines 143-275)
   - Maps accepted Q&A pairs to `model_training_data` table with IDs like `moderated_training_{qna.id}_{index}`
   - Optionally creates training data entries for Vector Store files (metadata records, not content extraction)
   - Stores in `model_training_data` table with `quality_score: 1.0`

5. **Create Model Version Row** (lines 277-339)
   - Generates version string: `v1.0.0-{timestamp}` (initial) or `v{timestamp}` (retraining)
   - Deactivates previous active versions
   - Inserts new row into `model_versions` table with:
     - `training_data_count`: Count of training data items
     - `performance_metrics`: JSONB with accuracy, confidence, response_time, vector_store info
     - `model_config`: JSONB with training sources, batch IDs
     - `status`: 'active'

6. **Store Performance Metrics** (lines 365-380)
   - Inserts into `model_performance` table with analysis of question/answer patterns

7. **Update System Config** (lines 415-427)
   - Updates `system_config.current_model_version` to new version string

**What Changes Persist:**
- Database rows in `model_training_data` table
- Database row in `model_versions` table
- `system_config.current_model_version` key updated
- Previous `model_versions` rows set to `status: 'inactive'`

**What Must Happen for Changes to Affect Live User Answers:**
- **NOTHING** - Model version changes do NOT affect runtime behavior. The code reads `current_model_version` for logging/metadata only (lines 120-143 in `app/api/ask/route.ts`). To actually affect answers:
  1. Update `SYSTEM_PROMPT` env var (triggers assistant instruction update)
  2. Update Vector Store files (affects file_search results)
  3. Change temperature/model selection (requires code change)

### 4.2 `app/api/check-vector-store/route.ts`

**Trigger Method:**
- Manual: `GET /api/check-vector-store`
- Protection: None (should be admin-protected)

**What It Does:**
- Retrieves Vector Store info via REST API
- Lists all files in Vector Store with pagination
- Returns JSON with file status counts and details

**What Changes Persist:**
- None - read-only endpoint

### 4.3 `scripts/create-initial-model.js`

**Trigger Method:**
- Manual: `node scripts/create-initial-model.js`
- Protection: None (script, not HTTP endpoint)

**What It Does:**
- Checks if model versions already exist (exits if found)
- Fetches from `qna_accepted` view
- Retrieves Vector Store metadata (if configured)
- Creates initial `model_versions` row and `model_training_data` rows
- Updates `system_config.current_model_version`

**What Changes Persist:**
- Same as `/api/retrain-model` - database rows only

### 4.4 `scripts/upload-jsonl-chunks.js`

**Trigger Method:**
- Manual: `node scripts/upload-jsonl-chunks.js`
- Protection: None (script, not HTTP endpoint)

**What It Does:**
- Reads JSONL file from hardcoded path (`/Users/josephvaleri/Downloads/QMF_Prompt_JV_vB_chunks (1).jsonl`)
- Creates text files for each chunk
- Uploads files to OpenAI: `openai.files.create({purpose: 'assistants'})`
- Adds files to Vector Store: `openai.vectorStores.files.create(vectorStoreId, {file_id})`
- Monitors processing status
- Cleans up temp files

**What Changes Persist:**
- Files in OpenAI Vector Store (persists across requests)
- Files are embedded and indexed by OpenAI

**What Must Happen for Changes to Affect Live User Answers:**
- Files must be in "completed" status (checked automatically by Assistants API)
- No code changes needed - file_search tool automatically uses new files

### 4.5 `scripts/check-vector-store.js`

**Trigger Method:**
- Manual: `node scripts/check-vector-store.js [vectorStoreId]`
- Protection: None (script, not HTTP endpoint)

**What It Does:**
- Lists Vector Store files and status
- Shows file counts by status (completed, in_progress, failed)
- Retrieves file details for first 5 files

**What Changes Persist:**
- None - read-only script

### 4.6 `scripts/trigger-model-retraining.js`

**Trigger Method:**
- Manual: `node scripts/trigger-model-retraining.js`
- Protection: None (script, not HTTP endpoint)

**What It Does:**
- Checks count of accepted/edited items in `moderation_queue`
- If >= 20, formats data for "OpenAI fine-tuning" (but does NOT call fine-tuning API)
- Saves JSONL file to `data/retraining_data.jsonl`
- Logs "TODO: Implement actual OpenAI fine-tuning API call" (line 87)

**What Changes Persist:**
- JSONL file written to disk (not used by system)

**Status:** **INCOMPLETE** - Does not actually trigger retraining or call OpenAI fine-tuning API.

---

## 5. Data Model (Supabase) Used for ML/Training

### 5.1 `model_versions` Table

**Schema (from `supabase/migrations/004_model_improvement_system.sql` lines 17-26):**
```sql
create table if not exists public.model_versions (
  id bigserial primary key,
  version text unique not null,
  training_data_count integer not null,
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive', 'testing')),
  performance_metrics jsonb,
  model_config jsonb,
  notes text
);
```

**Relationships:**
- Referenced by: `model_performance.model_version` (text, not FK)
- Referenced by: `system_config.current_model_version` (value stores version string)

**Usage:**
- Read in `app/api/ask/route.ts` lines 120-143 (for metadata only, does not affect behavior)
- Written in `app/api/retrain-model/route.ts` lines 332-334
- Written in `scripts/create-initial-model.js` lines 151-155
- Updated in `app/api/retrain-model/route.ts` lines 293-301 (deactivate old versions)

### 5.2 `model_training_data` Table

**Schema (from `supabase/migrations/004_model_improvement_system.sql` lines 5-14):**
```sql
create table if not exists public.model_training_data (
  id text primary key,
  question text not null,
  answer text not null,
  normalized_question text,
  created_at timestamptz not null,
  quality_score float default 1.0,
  training_batch_id text,
  created_at_training timestamptz default now()
);
```

**Relationships:**
- No foreign keys
- Referenced by `model_performance` via `model_config.training_batch_id` (indirect)

**Usage:**
- Written in `app/api/retrain-model/route.ts` lines 265-270
- Written in `scripts/create-initial-model.js` lines 109-114
- Read in `app/api/model-version/route.ts` lines 38-47 (for metadata only)

**Note:** This table is NOT used at runtime. It's metadata only.

### 5.3 `model_performance` Table

**Schema (from `supabase/migrations/004_model_improvement_system.sql` lines 48-55):**
```sql
create table if not exists public.model_performance (
  id bigserial primary key,
  model_version text not null,
  metric_name text not null,
  metric_value float not null,
  measured_at timestamptz not null default now(),
  context jsonb
);
```

**Relationships:**
- `model_version` references `model_versions.version` (text, not FK)

**Usage:**
- Written in `app/api/ask/route.ts` lines 561-571 (tracks response_length per Q&A)
- Written in `app/api/retrain-model/route.ts` lines 366-380 (tracks training data insights)
- Written in `scripts/create-initial-model.js` lines 192-206

### 5.4 `system_config` Table

**Schema (from `supabase/migrations/004_model_improvement_system.sql` lines 29-34):**
```sql
create table if not exists public.system_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);
```

**Initial Values (from migration lines 101-108):**
- `current_model_version`: 'v1.0.0'
- `model_improvement_enabled`: 'true'
- `retraining_threshold`: '20'
- `quality_threshold`: '0.8'
- `last_retraining_count`: '0'
- `moderated_content_driven`: 'true'

**Additional Keys Used (not in migration, inferred from code):**
- `assistant_id`: Cached OpenAI assistant ID (lines 252-256, 319-328, 367-376 in `app/api/ask/route.ts`)
- `assistant_instructions_hash`: SHA256 hash of instructions to detect changes (lines 268-294 in `app/api/ask/route.ts`)

**Usage:**
- Read/written extensively for caching and configuration

### 5.5 `moderation_queue` Table

**Schema (from `supabase/migrations/000_qmf_core.sql` lines 66-74, 001_add_crisis_fields.sql lines 2-4):**
```sql
create table if not exists public.moderation_queue (
  id bigserial primary key,
  qna_id bigint not null references public.qna(id) on delete cascade,
  status moderation_status not null default 'pending',
  moderator_id uuid references auth.users(id) on delete set null,
  moderator_notes text,
  edited_answer text,
  decided_at timestamptz,
  auto_flags jsonb,  -- added in 001_add_crisis_fields.sql
  source text        -- added in 001_add_crisis_fields.sql
);
```

**Relationships:**
- FK to `qna.id`
- FK to `auth.users.id` (moderator_id)

**Usage:**
- Written in `app/api/ask/route.ts` lines 612-616 (auto-insert on Q&A creation)
- Updated in `app/api/moderation/[action]/route.ts` lines 82-86 (moderator actions)
- Read in `app/api/moderation/[action]/route.ts` lines 111-114 (count for retraining trigger)
- Read via `qna_accepted` view (joins this table)

### 5.6 `qna` Table

**Schema (from `supabase/migrations/000_qmf_core.sql` lines 46-54):**
```sql
create table if not exists public.qna (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  anon_session_id uuid references public.anon_sessions(session_id) on delete set null,
  user_question text not null,
  user_question_norm text generated always as (lower(trim(user_question))) stored,
  assistant_answer text,
  created_at timestamptz not null default now()
);
```

**Relationships:**
- FK to `auth.users.id`
- FK to `anon_sessions.session_id`
- Referenced by `moderation_queue.qna_id`
- Referenced by `qna_accepted` view

**Usage:**
- Written in `app/api/ask/route.ts` lines 538-547
- Read via `qna_accepted` view for training data

### 5.7 `qna_accepted` View

**Schema (from `supabase/migrations/000_qmf_core.sql` lines 78-87):**
```sql
create or replace view public.qna_accepted as
select
  q.id,
  q.user_question,
  q.user_question_norm,
  coalesce(m.edited_answer, q.assistant_answer) as answer,
  q.created_at
from public.qna q
join public.moderation_queue m on m.qna_id = q.id
where m.status in ('accepted','edited');
```

**Usage:**
- Read in `app/api/retrain-model/route.ts` lines 25-28
- Read in `scripts/create-initial-model.js` lines 41-44
- Read in `scripts/trigger-model-retraining.js` lines 37-41

### 5.8 `anon_sessions` Table

**Schema (from `supabase/migrations/000_qmf_core.sql` lines 40-43):**
```sql
create table if not exists public.anon_sessions (
  session_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
```

**Relationships:**
- Referenced by `qna.anon_session_id`

**Usage:**
- Written in `app/api/ask/route.ts` lines 515-519 (create anonymous session if needed)

### 5.9 `chat_sessions` and `chat_messages` Tables

**Schema: NOT FOUND IN MIGRATIONS** - Referenced in code but no CREATE TABLE statements found.

**Inferred Schema (from usage in `app/api/chat/sessions/route.ts`, `app/api/chat/messages/route.ts`, `app/api/ask/route.ts`):**

`chat_sessions`:
- `id` (UUID, primary key)
- `user_id` (UUID, FK to auth.users)
- `session_name` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

`chat_messages`:
- `id` (bigserial, primary key, inferred)
- `session_id` (UUID, FK to chat_sessions.id)
- `role` (text: 'user' | 'assistant' | 'system')
- `content` (text)
- `created_at` (timestamptz, inferred)

**Usage:**
- Written in `app/api/ask/route.ts` lines 579-589 (save messages to session)
- Read in `app/api/ask/route.ts` lines 150-162 (retrieve session context)
- Written in `app/api/chat/sessions/route.ts` lines 95-102 (create session)
- Read in `app/api/chat/sessions/route.ts` lines 35-45 (list sessions)

---

## 6. Moderation + Curation Workflow

### 6.1 Content Flagging

**Location:** `app/api/ask/route.ts` lines 42-51

**Process:**
1. User question is checked via `moderationService.checkText(question)` (line 42)
2. `moderationService` (`lib/moderation.ts`) uses lexicon-based matching:
   - Loads word lists from `moderation_lexicons/` directory (profanity, sexual, hate_speech, violence, blasphemy, substance, derogatory)
   - Normalizes text and checks against lexicons
   - Returns `{flagged: boolean, categories: string[], reason: string}`
3. If flagged, currently only logs warning (line 46) - does NOT block request

**Crisis Detection:** Also runs `detectCrisis(question)` (line 39) which triggers special response with resources (lines 218-237).

### 6.2 Moderation Queue Population

**Location:** `app/api/ask/route.ts` lines 612-616

**Process:**
1. After Q&A is saved to `qna` table, row is auto-inserted into `moderation_queue`
2. Fields set:
   - `qna_id`: Reference to Q&A row
   - `status`: 'pending' (default)
   - `auto_flags`: JSONB with crisis detection data (if crisis detected)
   - `source`: String indicating source (e.g., 'detector:crisis', 'assistants:file_search')

### 6.3 Approval Process

**UI Location:** `app/moderation/page.tsx`

**API Location:** `app/api/moderation/[action]/route.ts`

**Process:**
1. Moderator/Admin accesses `/moderation` page (requires role check, line 53 in moderation page)
2. Page loads pending items: `SELECT * FROM moderation_queue WHERE status = 'pending'` (line 86)
3. Moderator can:
   - **Accept**: `POST /api/moderation/accept` sets `status = 'accepted'`
   - **Deny**: `POST /api/moderation/deny` sets `status = 'denied'`
   - **Edit**: `POST /api/moderation/edit` sets `status = 'edited'` and stores `edited_answer`
4. Actions update `moderation_queue` table:
   - `status` changed
   - `moderator_id` set to current user
   - `decided_at` set to current timestamp
   - `edited_answer` set (if edit action)

### 6.4 Curated Data Assembly for Retraining

**Location:** `app/api/retrain-model/route.ts` lines 24-48

**Process:**
1. Queries `qna_accepted` view (SQL view that joins `qna` + `moderation_queue`)
2. View filters for `status IN ('accepted', 'edited')`
3. Uses `COALESCE(m.edited_answer, q.assistant_answer)` to prefer edited answers
4. Maps to `model_training_data` table with structure:
   - `id`: `moderated_training_{qna.id}_{index}`
   - `question`: Original user question
   - `answer`: Edited answer (if edited) or original assistant answer
   - `quality_score`: 1.0 (high quality, moderated)
   - `training_batch_id`: Batch identifier

**No Manual Curation UI:** The system relies on moderation actions (accept/edit) to mark content for training. There is no separate UI for selecting which items should be used for training beyond the moderation workflow.

---

## 7. Vector Store Contents and Update Mechanics

### 7.1 VECTOR_STORE_ID Usage at Runtime

**Location:** `app/api/ask/route.ts` lines 203, 238-447

**Process:**
1. System checks if `process.env.VECTOR_STORE_ID` exists (line 203, 238)
2. If exists, uses Assistants API path:
   - Assistant is created/retrieved with `tool_resources.file_search.vector_store_ids: [VECTOR_STORE_ID]` (lines 356-358)
   - When user asks question, assistant uses `file_search` tool automatically
   - OpenAI searches Vector Store and includes relevant chunks in context
3. If not exists, falls back to Chat Completions API without Vector Store

**Single-Tenant/Shared:** **SHARED** - Single `VECTOR_STORE_ID` env var used for all requests. All users share the same knowledge base.

### 7.2 File Upload/Remove/List

**Upload:**
- **Script:** `scripts/upload-jsonl-chunks.js`
- **Process:**
  1. Parses JSONL file (hardcoded path)
  2. Creates temporary text files for each chunk
  3. `openai.files.create({file: fs.createReadStream(filePath), purpose: 'assistants'})` (line 88)
  4. `openai.vectorStores.files.create(VECTOR_STORE_ID, {file_id: file.id})` (line 96)
  5. Waits for processing (monitors status)
  6. Cleans up temp files

**List:**
- **API:** `GET /api/check-vector-store` uses REST API: `GET https://api.openai.com/v1/vector_stores/{id}/files` (lines 48-59)
- **Script:** `scripts/check-vector-store.js` uses `openai.beta.vectorStores.files.list()` (line 69)

**Remove:**
- **NOT IMPLEMENTED** - No code found to remove files from Vector Store

### 7.3 Chunking

**Location:** `scripts/upload-jsonl-chunks.js` lines 23-51

**Process:**
- JSONL file is already chunked (input format)
- Each line is a JSON object with `{input: string, metadata: {section: string}}`
- Script creates one file per chunk (no further chunking)
- OpenAI handles chunking internally when files are added to Vector Store (uses default chunking strategy)

**No Custom Chunking Logic:** The system relies on pre-chunked JSONL input or OpenAI's default chunking.

### 7.4 Failure Modes

**Missing VECTOR_STORE_ID:**
- **Behavior:** Falls back to Chat Completions API (line 479 in `app/api/ask/route.ts`)
- **Impact:** No file_search available, answers don't use Vector Store knowledge
- **Detection:** Warning logged (line 81)

**Empty Vector Store:**
- **Behavior:** Assistant still created, but file_search returns no results
- **Impact:** Answers don't benefit from knowledge base
- **Detection:** No explicit check - would need to monitor file counts

**Stale Assistant Instructions:**
- **Detection:** SHA256 hash comparison (lines 268-294 in `app/api/ask/route.ts`)
- **Auto-Update:** If `SYSTEM_PROMPT` hash changes, assistant instructions are updated via `openai.beta.assistants.update()` (lines 278, 331)
- **Caching:** Assistant ID cached in `system_config.assistant_id`, instructions hash cached in `system_config.assistant_instructions_hash`

**Assistant Not Found (Cached ID Invalid):**
- **Detection:** Try/catch on `openai.beta.assistants.retrieve()` (line 265)
- **Recovery:** Clear cache, find existing assistant or create new one (lines 298-346)

---

## 8. Model Versioning Logic

### 8.1 Current Model Version Selection

**Location:** `app/api/ask/route.ts` lines 120-124

**Process:**
1. Reads `system_config.current_model_version` key
2. Defaults to `'v1.0.0'` if not found
3. Queries `model_versions` table for details (lines 131-136)

**Storage:** `system_config` table, key: `'current_model_version'`, value: version string (e.g., `'v1.0.0-1234567890'`)

### 8.2 When It Changes

**Location:** `app/api/retrain-model/route.ts` lines 415-427

**Process:**
1. New model version created (line 332)
2. `system_config.current_model_version` updated via upsert (lines 415-427)
3. Also updated in `scripts/create-initial-model.js` lines 213-227

**Trigger:** Manual retraining endpoint call or initial model creation script

### 8.3 Does It Affect Runtime Behavior?

**NO** - Model version is read for metadata/logging only (lines 120-177 in `app/api/ask/route.ts`):

- Used to build `trainingDataNote` string (line 176) which is appended to system prompt
- Used for logging in `model_performance` table (line 562)
- **NOT used to:**
  - Select which OpenAI model to use (hardcoded `'gpt-4o'`, line 353)
  - Select which assistant to use (uses cached `assistant_id`, not version)
  - Select which Vector Store to use (uses `VECTOR_STORE_ID` env var, not version)
  - Select temperature (hardcoded `0.3`, line 360)

### 8.4 Mismatches

**Critical Mismatch:** `current_model_version` is stored and updated, but does NOT control which model/assistant/vector store is used at runtime. The version string is only used for:
1. Appending to system prompt as metadata text (user-facing note about training data count)
2. Logging metrics in `model_performance` table

**Evidence:**
- Model selection: Hardcoded `'gpt-4o'` (line 353, 455, 482 in `app/api/ask/route.ts`)
- Assistant selection: Uses cached `assistant_id` from `system_config`, not version-based lookup
- Vector Store: Uses `VECTOR_STORE_ID` env var directly, not from `model_versions.performance_metrics.vector_store_id`

---

## 9. Gaps / Bugs / Risks (Actionable)

### Critical

**1. Model Version Does Not Control Runtime Behavior**
- **Evidence:** `app/api/ask/route.ts` lines 120-177, 353, 455, 482
- **Why it matters:** Versioning system creates false sense of model control. Changes to `current_model_version` don't actually change which model is used.
- **Fix:** Either:
  - A) Remove versioning system if not needed, OR
  - B) Implement version-based model/assistant selection (store model name, temperature, vector_store_id in `model_versions`, read at runtime)

**2. No Fine-Tuning Implementation**
- **Evidence:** `scripts/trigger-model-retraining.js` line 87: `// TODO: Implement actual OpenAI fine-tuning API call`
- **Why it matters:** Script creates JSONL file but doesn't use it. System documentation implies fine-tuning but none exists.
- **Fix:** Either:
  - A) Remove fine-tuning references from docs/scripts, OR
  - B) Implement actual fine-tuning: upload JSONL to OpenAI, create fine-tuning job, monitor completion, update model config

**3. Retraining Endpoint Not Protected**
- **Evidence:** `app/api/retrain-model/route.ts` - no authentication check
- **Why it matters:** Anyone can trigger expensive operations and modify database
- **Fix:** Add authentication check similar to `app/api/moderation/[action]/route.ts` lines 34-50 (require moderator/admin role)

### High

**4. Hardcoded Model Name Ignores Env Var**
- **Evidence:** `app/api/ask/route.ts` lines 353, 455, 482 use `'gpt-4o'` hardcoded, but `lib/openai.ts` line 5 defines `chatModel` from `OPENAI_CHAT_MODEL` env var
- **Why it matters:** Can't change model without code deployment
- **Fix:** Replace hardcoded strings with `chatModel` from `lib/openai.ts` or read from env var directly

**5. Hardcoded Temperature**
- **Evidence:** `app/api/ask/route.ts` lines 360, 458, 485 use `temperature: 0.3` hardcoded
- **Why it matters:** Can't tune temperature without code deployment
- **Fix:** Read from env var (e.g., `OPENAI_TEMPERATURE`) or `system_config` table

**6. Chat Sessions/Messages Tables Not in Migrations**
- **Evidence:** Tables referenced in code but no CREATE TABLE in migrations
- **Why it matters:** Schema not version-controlled, may cause deployment issues
- **Fix:** Add migration file with CREATE TABLE statements for `chat_sessions` and `chat_messages`

**7. Vector Store File Removal Not Implemented**
- **Evidence:** No code found to remove files from Vector Store
- **Why it matters:** Can't clean up outdated files, Vector Store grows indefinitely
- **Fix:** Implement endpoint/script using `openai.beta.vectorStores.files.delete()`

### Medium

**8. History Window Inconsistency**
- **Evidence:** Assistants API uses last 3 messages (line 396), Chat Completions uses full history (line 195)
- **Why it matters:** Different behavior between primary and fallback paths
- **Fix:** Standardize history window size (make configurable via env var)

**9. Moderation Only Logs, Doesn't Block**
- **Evidence:** `app/api/ask/route.ts` lines 43-51 - flagged content is logged but request continues
- **Why it matters:** Inappropriate content may still generate responses
- **Fix:** Add configurable block mode (env var `MODERATION_BLOCK_ENABLED`)

**10. Anonymous Session Cookie Security**
- **Evidence:** `app/api/ask/route.ts` line 638 sets cookie with `HttpOnly; SameSite=Lax` but no `Secure` flag
- **Why it matters:** Cookie may be transmitted over HTTP if site not fully HTTPS
- **Fix:** Add `Secure` flag when `NODE_ENV === 'production'`

### Low

**11. Upload Script Uses Hardcoded Path**
- **Evidence:** `scripts/upload-jsonl-chunks.js` line 169: hardcoded path to Downloads folder
- **Why it matters:** Script not portable
- **Fix:** Accept file path as command-line argument

**12. Model Performance Metrics Not Used**
- **Evidence:** `model_performance` table is written but never read/analyzed
- **Why it matters:** Collected data not actionable
- **Fix:** Create admin dashboard to visualize metrics, or remove if not needed

**13. Missing Error Handling for Vector Store File Retrieval**
- **Evidence:** `app/api/retrain-model/route.ts` line 217 - `openai.files.retrieve()` may fail for deleted files
- **Why it matters:** Retraining may fail if Vector Store contains invalid file references
- **Fix:** Add try/catch around file retrieval (partially exists but could be more robust)

---

## 10. "Definition of Done" Checklist

### 10.1 Test: Retraining Changes Answers

**Current State:** Retraining does NOT change answers (only updates metadata).

**Test to Prove It Works (if fixed):**
1. Create initial Q&A: Ask "What is faith?" → Get response A
2. Accept Q&A in moderation queue
3. Trigger retraining (call `/api/retrain-model` or wait for threshold)
4. Verify `model_versions` row created with new version
5. Ask same question again → Should get different response if fine-tuning implemented
6. **Current Result:** Response will be identical (no fine-tuning)

**If Fine-Tuning Implemented:**
- After step 3, wait for fine-tuning job to complete
- Update system to use fine-tuned model name
- Step 5 should produce different response

### 10.2 Test: Assistant Instructions Update on Prompt Change

**Test:**
1. Set `SYSTEM_PROMPT="You are helpful."` in env
2. Make API request to `/api/ask` → Assistant created/retrieved
3. Check `system_config.assistant_instructions_hash` → Note hash value
4. Change `SYSTEM_PROMPT="You are very helpful and concise."`
5. Make another API request to `/api/ask`
6. Verify:
   - Hash in `system_config.assistant_instructions_hash` updated
   - `openai.beta.assistants.update()` called (check logs)
   - Assistant instructions reflect new prompt (retrieve assistant via API and check `instructions` field)

**Expected Result:** Instructions update automatically (this should work currently, lines 276-280, 331-333 in `app/api/ask/route.ts`)

### 10.3 Test: Vector Store File Changes Are Used in Retrieval

**Test:**
1. Upload file to Vector Store with unique content (e.g., "The capital of TestLand is TestCity")
2. Wait for file status to be "completed" (check via `/api/check-vector-store`)
3. Ask question that should retrieve this content: "What is the capital of TestLand?"
4. Verify response mentions "TestCity"
5. Remove file from Vector Store (if removal implemented)
6. Ask same question again
7. Verify response does NOT mention "TestCity" (or file not found error)

**Current Limitation:** File removal not implemented, so step 5-7 can't be tested yet.

### 10.4 Recommended Logging (Exact Locations)

**1. Assistant Creation/Update Events**
- **Location:** `app/api/ask/route.ts` after line 362 (after assistant.create)
- **Log:** `{event: 'assistant_created', assistant_id, instructions_hash, vector_store_id}`
- **Location:** `app/api/ask/route.ts` after line 278 (after assistant.update)
- **Log:** `{event: 'assistant_updated', assistant_id, old_hash, new_hash, reason: 'instructions_changed'}`

**2. Model Version Changes**
- **Location:** `app/api/retrain-model/route.ts` after line 427 (after system_config update)
- **Log:** `{event: 'model_version_changed', old_version, new_version, training_data_count, trigger: 'retraining'|'manual'}`

**3. Vector Store File Operations**
- **Location:** `scripts/upload-jsonl-chunks.js` after line 100 (after file added to vector store)
- **Log:** `{event: 'vector_store_file_added', file_id, vector_store_id, status, filename}`
- **Location:** `app/api/ask/route.ts` after line 447 (after streaming completes)
- **Log:** `{event: 'assistant_response_complete', used_file_search: boolean, vector_store_id, response_length, model_version}`

**4. Moderation-to-Retraining Pipeline**
- **Location:** `app/api/moderation/[action]/route.ts` after line 159 (after retraining trigger)
- **Log:** `{event: 'retraining_triggered', current_count, threshold, qna_ids: [...], triggered_by: 'moderation_action'}`

**5. Performance Metrics**
- **Location:** `app/api/ask/route.ts` after line 571 (after model_performance insert)
- **Log:** `{event: 'performance_metric_recorded', model_version, metric_name, metric_value, qna_id, response_time_ms}`

**6. Fallback Scenarios**
- **Location:** `app/api/ask/route.ts` after line 450 (in catch block)
- **Log:** `{event: 'assistants_api_fallback', error: string, error_code: string, falling_back_to: 'chat_completions'}`
- **Location:** `app/api/ask/route.ts` after line 81 (VECTOR_STORE_ID missing)
- **Log:** `{event: 'vector_store_unavailable', reason: 'VECTOR_STORE_ID_missing', using_fallback: 'chat_completions'}`

---

**Report Generated:** Based on codebase analysis. All file paths and line numbers verified against actual code.
