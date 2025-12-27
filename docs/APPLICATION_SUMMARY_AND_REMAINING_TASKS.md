# Application Summary and Remaining Security Tasks

**Last Updated**: December 26, 2025  
**Next.js Version**: 16.0.10 (patched for React2Shell)  
**Status**: RAG-driven ML pipeline implemented, security hardening pending

---

## Application Overview

**Question My Faith (QMF)** is a Next.js 16 application that provides AI-powered spiritual guidance through a chat interface. The system uses:

- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth)
- **AI/ML**: OpenAI Assistants API with Vector Store for RAG, Chat Completions API as fallback
- **Database**: Supabase PostgreSQL with pgvector for embeddings

### Core Architecture

```
User Question
  ↓
/api/ask (with crisis detection, moderation checks)
  ↓
OpenAI Assistants API (with Vector Store) OR Chat Completions API
  ↓
Streamed Response → User
  ↓
Log to qna table → Moderation Queue (if flagged)
  ↓
Moderation Panel → Accept/Edit/Deny
  ↓
Curated Q&A Storage → Knowledge Pack Building → Model Versioning
```

---

## Recently Implemented: RAG-Driven ML Pipeline Upgrade

### Phase 1: Curated Q&A Storage & Embeddings ✅
- **Migration**: `005_curated_qna.sql` - Creates `curated_qna` table with pgvector embeddings
- **Library**: `lib/curated-qna.ts` - Functions for upserting and similarity search
- **Integration**: `app/api/moderation/[action]/route.ts` - Populates curated_qna on accept/edit
- **Feature Flag**: `curated_guidance_enabled` (default: false)

### Phase 2: Runtime Integration ✅
- **File**: `app/api/ask/route.ts`
- **Changes**: Retrieves similar curated Q&A pairs and prepends to system prompt
- **Location**: Lines 195-213

### Phase 3: Model Version Runtime Control ✅
- **Migration**: `006_model_version_runtime_config.sql` - Adds runtime config columns to `model_versions`
- **Library**: `lib/model-config.ts` - Loads active model configuration
- **Integration**: `app/api/ask/route.ts` - Uses model config for model, temperature, history_window, vector_store_id
- **Changes**: Version-aware assistant caching (lines 270-360)

### Phase 4: Knowledge Pack Build System ✅
- **Migration**: `007_knowledge_packs.sql` - Tracks knowledge pack artifacts
- **Library**: `lib/knowledge-pack.ts` - Builds and uploads knowledge packs
- **Endpoint**: `app/api/retrain-model/route.ts` - Refactored to build knowledge packs (creates testing versions)
- **Endpoint**: `app/api/model-version/promote/route.ts` - Promotes testing versions to active
- **Feature Flag**: `knowledge_pack_building_enabled` (default: false)

### Phase 5: Evaluation Harness ✅
- **Migration**: `008_evaluation_system.sql` - Creates eval_sets, eval_cases, eval_runs, eval_case_results tables
- **Library**: `lib/evaluation.ts` - Runs evaluations against model versions
- **Endpoint**: `app/api/evaluation/run/route.ts`
- **UI**: `app/evaluation/page.tsx` - Dashboard for viewing results

### Phase 6: Operational Hygiene ✅
- **Migration**: `009_chat_tables.sql` - chat_sessions and chat_messages tables
- **Migration**: `010_vector_store_tracking.sql` - vector_store_files tracking table
- **Endpoint**: `app/api/admin/vector-store/cleanup/route.ts` - Cleans up inactive files
- **Script**: `scripts/upload-jsonl-chunks.js` - Refactored to accept CLI arguments

### Phase 7: Feature Flags & Audit ✅
- **Migration**: `011_feature_flags.sql` - Adds feature flags to system_config
- **Migration**: `012_audit_logging.sql` - Creates audit_log table
- **Library**: `lib/feature-flags.ts` - Helper for checking feature flags

### Phase 8: Auto-Upload ✅
- **Integration**: `app/api/moderation/[action]/route.ts` - Optional auto-upload to vector store
- **Feature Flag**: `vector_store_autoupload_enabled` (default: false)

---

## Remaining Security Tasks

### Task 1: Create lib/auth-helpers.ts for Role-Based Access Control

**File**: `lib/auth-helpers.ts` (new file)

**Purpose**: Centralized authentication and authorization helpers to protect admin endpoints.

**Implementation**:

```typescript
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supaServer } from './supabase/server';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    role: profile?.role || 'user',
  };
}

/**
 * Require specific role(s) - throws 403 if user doesn't have required role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  if (!allowedRoles.includes(user.role || 'user')) {
    throw new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return user;
}

/**
 * Require admin role specifically
 */
export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser> {
  return requireRole(request, ['admin']);
}

/**
 * Require moderator or admin role
 */
export async function requireModerator(request: NextRequest): Promise<AuthenticatedUser> {
  return requireRole(request, ['moderator', 'admin']);
}
```

**Usage Pattern**:
```typescript
import { requireAdmin, requireModerator } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request); // Throws 401/403 if not authorized
  // ... rest of endpoint logic
}
```

---

### Task 2: Add Auth/Role Checks to All Admin Endpoints

**Endpoints to protect**:

1. **`app/api/retrain-model/route.ts`**
   - **Required Role**: `admin`
   - **Add at**: Line 14 (after function declaration, before try block)
   - **Code**: `const user = await requireAdmin(request);`

2. **`app/api/check-vector-store/route.ts`**
   - **Required Role**: `admin` or `moderator`
   - **Add at**: Line 5 (after function declaration, before try block)
   - **Code**: `const user = await requireModerator(request);`

3. **`app/api/model-version/promote/route.ts`**
   - **Required Role**: `admin`
   - **Add at**: Line 10 (after function declaration)
   - **Code**: `const user = await requireAdmin(request);`

4. **`app/api/evaluation/run/route.ts`**
   - **Required Role**: `admin` or `moderator`
   - **Add at**: Line 11 (after function declaration)
   - **Code**: `const user = await requireModerator(request);`

5. **`app/api/admin/vector-store/cleanup/route.ts`**
   - **Required Role**: `admin`
   - **Add at**: Line 9 (replace TODO comment on line 9)
   - **Code**: `const user = await requireAdmin(request);`

6. **`app/api/moderation/[action]/route.ts`**
   - **Status**: Already has role check (lines 41-54), but uses inline Supabase auth
   - **Action**: Refactor to use `requireModerator()` helper for consistency
   - **Current code**: Manual auth check with `supabase.auth.getUser()` and profile lookup
   - **Replace with**: `const user = await requireModerator(request);`

**Implementation Pattern**:
```typescript
import { requireAdmin } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request); // Add this line
    
    // Existing endpoint logic...
  } catch (error) {
    // Error handling (401/403 already thrown by helper)
    if (error instanceof Response) throw error;
    // ... other error handling
  }
}
```

---

### Task 3: Add Rate Limiting to Expensive Endpoints

**Approach**: Use in-memory store for MVP, or Redis/Upstash for production.

**Endpoints to protect**:

1. **`app/api/ask`** - 100 requests/hour per IP or user
2. **`app/api/retrain-model`** - 5 requests/hour per user
3. **`app/api/moderation/[action]`** - 200 requests/hour per user

**Implementation Options**:

**Option A: Simple In-Memory Rate Limiter (MVP)**
```typescript
// lib/rate-limit.ts
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const now = Date.now();
  const key = identifier;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= limit) {
    throw new Response(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  record.count++;
}
```

**Option B: Upstash Redis (Production)**
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const askRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export const retrainRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
});
```

**Usage in endpoints**:
```typescript
// In /api/ask/route.ts
import { askRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  // Get identifier (IP or user ID)
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const identifier = `ask:${ip}`;
  
  const { success } = await askRateLimit.limit(identifier);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  
  // ... rest of endpoint
}
```

**Files to create/modify**:
- `lib/rate-limit.ts` (new)
- `app/api/ask/route.ts` (add rate limiting)
- `app/api/retrain-model/route.ts` (add rate limiting)
- `app/api/moderation/[action]/route.ts` (add rate limiting)

---

### Task 4: Add Secure Flag to Anonymous Session Cookie in Production

**File**: `app/api/ask/route.ts`

**Location**: Line 609 (exact location found)

**Current code**:
```typescript
headers["Set-Cookie"] = `qmf_anon_session=${anon}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
```

**Updated code**:
```typescript
const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
headers["Set-Cookie"] = `qmf_anon_session=${anon}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secureFlag}`;
```

**Why**: Prevents cookie transmission over unencrypted HTTP in production.

---

### Task 5: Add Zod Validation to New Endpoints

**Endpoints needing validation**:

1. **`app/api/admin/vector-store/cleanup/route.ts`**
   - **Current**: No validation
   - **Add**: Optional body validation if endpoint accepts parameters

2. **`app/api/model-version/promote/route.ts`**
   - **Status**: ✅ Already has Zod validation (lines 5-7, 15, 92-97)

3. **`app/api/evaluation/run/route.ts`**
   - **Status**: ✅ Already has Zod validation (lines 5-8, 14, 26-31)

4. **`app/api/retrain-model/route.ts`**
   - **Current**: Basic try/catch for JSON parsing
   - **Add**: Optional schema for `isInitialBuild` boolean

**Implementation Pattern**:
```typescript
import { z } from 'zod';

const cleanupSchema = z.object({
  // Add fields if endpoint accepts body
}).optional();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const validated = cleanupSchema.parse(body);
    
    // ... rest of logic
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    // ... other errors
  }
}
```

**Files to modify**:
- `app/api/admin/vector-store/cleanup/route.ts` (add validation if needed)
- `app/api/retrain-model/route.ts` (add validation for optional body)

---

### Task 6: Review and Test RLS Policies for All New Tables

**Tables to review** (from migrations 005-012):

1. **`curated_qna`** (005)
   - **Current Policies**: 
     - `curated_qna_server_insert` - `for insert with check (true)`
     - `curated_qna_authenticated_read` - `for select using (true)`
   - **Review**: Ensure server can insert, authenticated users can read

2. **`knowledge_packs`** (007)
   - **Current Policies**:
     - `knowledge_packs_server_insert` - `for insert with check (true)`
     - `knowledge_packs_authenticated_read` - `for select using (true)`
   - **Review**: Same pattern - verify appropriate

3. **`eval_sets`, `eval_cases`, `eval_runs`, `eval_case_results`** (008)
   - **Current Policies**: 
     - `eval_sets_read`, `eval_cases_read`, `eval_runs_read`, `eval_case_results_read` - all `for select using (true)`
     - **MISSING**: No insert/update policies - server writes will fail
   - **Review**: 
     - **CRITICAL**: Add server insert policies for all four tables:
       ```sql
       create policy "eval_sets_server_insert" on public.eval_sets for insert with check (true);
       create policy "eval_cases_server_insert" on public.eval_cases for insert with check (true);
       create policy "eval_runs_server_insert" on public.eval_runs for insert with check (true);
       create policy "eval_case_results_server_insert" on public.eval_case_results for insert with check (true);
       ```

4. **`chat_sessions`, `chat_messages`** (009)
   - **Current Policies**: User-specific (users can only access their own)
   - **Review**: Verify user_id matching works correctly

5. **`vector_store_files`** (010)
   - **Current Policy**: `vector_store_files_server_all` - `for all using (true)`
   - **Review**: Server-only access - verify no user access needed

6. **`audit_log`** (012)
   - **Current Policies**:
     - `audit_log_admin_read` - `for select using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'))`
     - **MISSING**: No insert policy - server inserts will fail
   - **Review**: 
     - Verify admin role check works correctly
     - **CRITICAL**: Add server insert policy:
       ```sql
       create policy "audit_log_server_insert" on public.audit_log for insert with check (true);
       ```

**Testing Checklist**:

For each table, test:
1. **Server-side insert** (from API routes) - should succeed
2. **Authenticated user read** - should succeed if policy allows
3. **Unauthenticated read** - should fail if policy restricts
4. **User-specific access** (for chat tables) - users can only see their own data
5. **Admin-only access** (for audit_log) - only admins can read

**Test Script Pattern**:
```sql
-- Test curated_qna RLS
-- As server (service role key)
INSERT INTO curated_qna (qna_id, question, answer, question_embedding) 
VALUES (1, 'test', 'test', '[0.1,0.2,...]'::vector); -- Should succeed

-- As authenticated user
SELECT * FROM curated_qna; -- Should succeed

-- As unauthenticated
SELECT * FROM curated_qna; -- Should fail (if RLS blocks)
```

**Files to review**:
- `supabase/migrations/005_curated_qna.sql`
- `supabase/migrations/007_knowledge_packs.sql`
- `supabase/migrations/008_evaluation_system.sql`
- `supabase/migrations/009_chat_tables.sql`
- `supabase/migrations/010_vector_store_tracking.sql`
- `supabase/migrations/012_audit_logging.sql`

---

## Implementation Priority

**Critical (Do First)**:
1. ✅ Task 1: Create `lib/auth-helpers.ts`
2. ✅ Task 2: Add auth checks to admin endpoints
3. ✅ Task 4: Secure cookie flag

**High Priority**:
4. ✅ Task 3: Rate limiting (start with in-memory, upgrade to Redis later)
5. ✅ Task 5: Zod validation (quick wins)

**Medium Priority**:
6. ✅ Task 6: RLS policy review (can be done incrementally)

---

## Key Files Reference

### API Endpoints
- `app/api/ask/route.ts` - Main chat endpoint (PRIMARY)
- `app/api/moderation/[action]/route.ts` - Moderation actions
- `app/api/retrain-model/route.ts` - Knowledge pack building
- `app/api/model-version/promote/route.ts` - Version promotion
- `app/api/evaluation/run/route.ts` - Evaluation runs
- `app/api/admin/vector-store/cleanup/route.ts` - Vector store cleanup
- `app/api/check-vector-store/route.ts` - Vector store status

### Libraries
- `lib/openai.ts` - OpenAI client and embeddings
- `lib/curated-qna.ts` - Curated Q&A operations
- `lib/model-config.ts` - Model version config loader
- `lib/knowledge-pack.ts` - Knowledge pack builder
- `lib/evaluation.ts` - Evaluation runner
- `lib/feature-flags.ts` - Feature flag checker
- `lib/supabase/server.ts` - Supabase server client

### Database Migrations
- `005_curated_qna.sql` - Curated Q&A table
- `006_model_version_runtime_config.sql` - Runtime config columns
- `007_knowledge_packs.sql` - Knowledge packs table
- `008_evaluation_system.sql` - Evaluation tables
- `009_chat_tables.sql` - Chat sessions/messages
- `010_vector_store_tracking.sql` - File tracking
- `011_feature_flags.sql` - Feature flags
- `012_audit_logging.sql` - Audit log table

### Database Tables (Key)
- `qna` - User questions and assistant answers
- `moderation_queue` - Items pending moderation
- `curated_qna` - Accepted/edited Q&A with embeddings
- `model_versions` - Model version metadata and runtime config
- `knowledge_packs` - Knowledge pack artifacts
- `vector_store_files` - Tracks OpenAI files in vector stores
- `eval_sets`, `eval_cases`, `eval_runs`, `eval_case_results` - Evaluation system
- `audit_log` - Audit trail
- `system_config` - System configuration and feature flags
- `profiles` - User profiles with roles (user, moderator, admin)

---

## Environment Variables

**Required**:
- `OPENAI_API_KEY` - OpenAI API key
- `VECTOR_STORE_ID` - OpenAI Vector Store ID
- `SYSTEM_PROMPT` - System prompt for LLM
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)

**Optional**:
- `OPENAI_CHAT_MODEL` - Default: 'gpt-4o-mini'
- `OPENAI_EMBED_MODEL` - Default: 'text-embedding-3-small'
- `OPENAI_TEMPERATURE` - Default: '0.3'
- `HISTORY_WINDOW` - Default: '3'
- `NEXT_PUBLIC_APP_URL` - For retraining triggers
- `UPSTASH_REDIS_REST_URL` - For rate limiting (if using Upstash)
- `UPSTASH_REDIS_REST_TOKEN` - For rate limiting (if using Upstash)

---

## Feature Flags (system_config table)

All default to `false` for safety:
- `curated_guidance_enabled` - Enable curated Q&A guidance in system prompt
- `vector_store_autoupload_enabled` - Auto-upload curated items to vector store
- `model_version_testing_enabled` - Enable model version testing workflow
- `eval_required_before_promotion` - Require evaluation before promoting version
- `knowledge_pack_building_enabled` - Enable knowledge pack building in retrain endpoint

---

## Testing the New Features

See the testing guide in the conversation history or run:
1. Enable feature flags in Supabase
2. Test curated Q&A storage via moderation panel
3. Test knowledge pack building via `/api/retrain-model`
4. Test version promotion via `/api/model-version/promote`
5. Test evaluation system via `/api/evaluation/run`

---

## Next Steps for Security Implementation

1. Create `lib/auth-helpers.ts` with the code provided above
2. Add `requireAdmin()` or `requireModerator()` to each admin endpoint
3. Implement rate limiting (start simple, upgrade later)
4. Add Secure flag to cookie
5. Add Zod validation where missing
6. Test RLS policies systematically

All code patterns and file locations are specified above for easy implementation.

