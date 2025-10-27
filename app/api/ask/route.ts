import { NextRequest } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { supaServer } from "@/lib/supabase/server";
import { moderationService } from "@/lib/moderation";
import { detectCrisis, crisisResources } from "@/lib/crisis";
import { z } from "zod";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant" | "system"; content: string };

const schema = z.object({
  question: z.string().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string()
  })).optional().default([])
});

export async function POST(req: NextRequest) {
  try {
    const { question, history } = schema.parse(await req.json());

    // Check for crisis situations FIRST (before moderation)
    const crisis = detectCrisis(question);
    
    // Check user input for inappropriate content
    const moderationResult = await moderationService.checkText(question);
    if (moderationResult.flagged) {
      console.log('Content flagged for moderation:', moderationResult);
      return new Response(JSON.stringify({ 
        error: 'Your message contains inappropriate content and cannot be processed.',
        details: moderationResult.reason
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Debug logging
    console.log('API Request received:', { question, historyLength: history.length });
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasVectorStore: !!process.env.VECTOR_STORE_ID,
      hasSystemPrompt: !!process.env.SYSTEM_PROMPT,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
    });

    // Check if required environment variables are present
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is missing');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!process.env.VECTOR_STORE_ID) {
      console.error('VECTOR_STORE_ID is missing');
      return new Response(JSON.stringify({ error: 'Vector store not configured' }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const supa = supaServer();

    // Query OpenAI Vector Store for relevant context
    let relevantContext = '';
    try {
      console.log('Querying OpenAI vector store for relevant context...');

      // Create an assistant with the vector store for file search
      const assistant = await openai.beta.assistants.create({
        name: "Question My Faith Assistant",
        instructions: "You are a helpful assistant for Question My Faith. Use the provided knowledge base to answer questions about faith, spirituality, and related topics.",
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [process.env.VECTOR_STORE_ID]
          }
        }
      });

      // Create a thread and run
      const thread = await openai.beta.threads.create({
        messages: [{
          role: "user",
          content: `Based on the QMF knowledge base, provide relevant context for this question: "${question}". 

Focus on:
- Conversational personality guidelines
- Interaction principles and empathy techniques
- Theological alignment and response patterns
- Guardrails and boundaries
- Specific guidance for the user's situation

Provide the most relevant sections that would help craft an appropriate response.`
        }]
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id
      });

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id as any);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      while ((runStatus.status === 'in_progress' || runStatus.status === 'queued') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id as any);
        attempts++;
      }

      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];
        if (lastMessage.content[0].type === 'text') {
          relevantContext = lastMessage.content[0].text.value;
          console.log('Retrieved context from vector store:', relevantContext.substring(0, 100) + '...');
        }
      } else {
        console.warn('Vector store query failed or timed out:', runStatus.status);
      }

      // Clean up - no need to delete assistant
      
    } catch (error) {
      console.error('Error querying OpenAI vector store:', error);
      // Continue without context if vector store query fails
    }

    // Create enhanced system prompt with document context
    const basePrompt = process.env.SYSTEM_PROMPT || "You are a helpful assistant.";
    
    const enhancedSystemPrompt = `${basePrompt}

${relevantContext ? `\nRelevant context from the QMF knowledge base:\n${relevantContext}\n` : ''}

Remember: Keep responses to 2-4 sentences maximum. Use calm, succinct, empathetic voice. Listen first, ask permission before offering spiritual insight.`;

    const input: Msg[] = [
      { role: "system", content: enhancedSystemPrompt },
      ...history,
      { role: "user", content: String(question || "").trim() }
    ];

    // Generate AI response
    console.log('Making OpenAI Chat Completions request with context...');

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: input,
      stream: true,
      temperature: 0.7,
      max_tokens: 200,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    // Identify caller (authed or anon) BEFORE streaming
    const { data: auth } = await supa.auth.getUser();
    const cookieStore = await cookies();
    let anon = cookieStore.get('qmf_anon_session')?.value ?? null;

    console.log('Auth check:', {
      hasUser: !!auth.user,
      userId: auth.user?.id,
      hasAnonCookie: !!anon,
      anonCookieValue: anon
    });

    // Create or verify anonymous session if user is not authenticated
    if (!auth.user) {
      if (!anon) {
        // No cookie - create new session
        const { data: anonSession, error: anonErr } = await supa
          .from('anon_sessions')
          .insert({})
          .select('session_id')
          .single();

        if (anonSession && !anonErr) {
          anon = anonSession.session_id;
          console.log('Created new anonymous session:', anon);
        } else {
          console.error('Failed to create anonymous session:', anonErr);
          anon = null;
        }
      } else {
        // Cookie exists - verify session exists in DB, create if not
        console.log('Verifying existing anonymous session:', anon);
        
        const { data: existingSession, error: checkErr } = await supa
          .from('anon_sessions')
          .select('session_id')
          .eq('session_id', anon)
          .single();

        if (!existingSession || checkErr) {
          console.log('Session not found in DB, creating new session...');
          // Create new session with the UUID from cookie
          const { data: anonSession, error: anonErr } = await supa
            .from('anon_sessions')
            .insert({ session_id: anon })
            .select('session_id')
            .single();

          if (anonSession && !anonErr) {
            console.log('Recreated session in database:', anon);
          } else {
            console.error('Failed to recreate session:', anonErr);
            // Fallback: create new session
            const { data: newSession, error: newErr } = await supa
              .from('anon_sessions')
              .insert({})
              .select('session_id')
              .single();
            
            if (newSession && !newErr) {
              anon = newSession.session_id;
              console.log('Created fallback session:', anon);
            } else {
              anon = null;
            }
          }
        } else {
          console.log('Session verified in database');
        }
      }
    }

    // Collect full response for DB storage
    let fullResponse = '';
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Handle crisis response
          let crisisResponse = '';
          if (crisis.isCrisis) {
            const res = crisisResources("US");
            crisisResponse = `${res.title}\n\n${res.lines.map((l) => `- ${l}`).join('\n')}\n\n${res.footer}\n\n_I'm not a substitute for professional help, but I care about your safety._`;
            fullResponse = crisisResponse;
            
            // Stream the crisis response
            const chunks = crisisResponse.split(' ');
            for (const chunk of chunks) {
              const data = `data: ${JSON.stringify({
                choices: [{
                  delta: { content: chunk + ' ' }
                }]
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          } else {
            // Normal streaming from OpenAI
            for await (const chunk of stream) {
              if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                fullResponse += content; // Accumulate full response
                const data = `data: ${JSON.stringify({
                  choices: [{
                    delta: { content: content }
                  }]
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
          // NOW save to database AFTER stream completes
          console.log('Stream complete, saving to database...');
          
          // Persist Q&A row
          console.log('Attempting to insert Q&A:', {
            user_id: auth.user?.id ?? null,
            anon_session_id: auth.user ? null : anon,
            user_question: question,
            assistant_answer: fullResponse?.substring(0, 100) + '...'
          });

          const { data: qnaRow, error: insErr } = await supa
            .from('qna')
            .insert({
              user_id: auth.user?.id ?? null,
              anon_session_id: auth.user ? null : anon,
              user_question: question,
              assistant_answer: fullResponse
            })
            .select('id')
            .single();

          if (insErr || !qnaRow) {
            console.error('Failed to insert Q&A:', insErr);
            console.error('Auth user:', auth.user);
            console.error('Anon session:', anon);
            // Continue even if DB insert fails
          } else {
            console.log('Successfully inserted Q&A with ID:', qnaRow.id);
            // Queue for moderation
            try {
              const autoFlags = crisis.isCrisis ? {
                crisis_detected: true,
                category: crisis.category,
                matches: crisis.matches,
              } : null;
              
              await supa.from('moderation_queue').insert({ 
                qna_id: qnaRow.id,
                auto_flags: autoFlags,
                source: crisis.isCrisis ? 'detector:crisis' : 'assistants:file_search'
              });
            } catch (err) {
              console.error('Failed to insert moderation queue:', err);
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    };

    // Set anonymous session cookie if needed
    if (anon && !auth.user) {
      headers['Set-Cookie'] = `qmf_anon_session=${anon}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
    }

    return new Response(readable, { headers });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}