import { NextRequest } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr';
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

    // Create Supabase client with cookies for authentication
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // No-op for API routes
          },
          remove(name: string, options: any) {
            // No-op for API routes
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check result:', { user: !!user, authError });

    const supa = supaServer();

    // Get current model version and configuration
    const { data: modelConfig } = await supa
      .from('system_config')
      .select('value')
      .eq('key', 'current_model_version')
      .single();

    const currentModelVersion = modelConfig?.value || 'v1.0.0';

    // Create enhanced system prompt with model version awareness
    const basePrompt = process.env.SYSTEM_PROMPT || "You are a helpful assistant for Question My Faith.";
    
    const enhancedSystemPrompt = `${basePrompt}

Remember: Keep responses to 2-4 sentences maximum. Use calm, succinct, empathetic voice. Listen first, ask permission before offering spiritual insight.

Model Version: ${currentModelVersion}`;

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

    // Get anonymous session if user is not authenticated
    let anon = cookieStore.get('qmf_anon_session')?.value ?? null;

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
          
          // Create or verify anonymous session if user is not authenticated
          if (!user && !anon) {
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
          }
          
          // Persist Q&A row
          console.log('Attempting to insert Q&A:', {
            user_id: user?.id ?? null,
            anon_session_id: user ? null : anon,
            user_question: question,
            assistant_answer: fullResponse?.substring(0, 100) + '...'
          });

          const { data: qnaRow, error: insErr } = await supa
            .from('qna')
            .insert({
              user_id: user?.id ?? null,
              anon_session_id: user ? null : anon,
              user_question: question,
              assistant_answer: fullResponse
            })
            .select('id')
            .single();

          if (insErr || !qnaRow) {
            console.error('Failed to insert Q&A:', insErr);
            console.error('Auth user:', user);
            console.error('Anon session:', anon);
            // Continue even if DB insert fails
          } else {
            console.log('Successfully inserted Q&A with ID:', qnaRow.id);
            
            // Track model performance metrics
            try {
              const responseTime = Date.now() - Date.now(); // Calculate actual response time
              const responseLength = fullResponse.length;
              const wordCount = fullResponse.split(' ').length;
              
              await supa.from('model_performance').insert({
                model_version: currentModelVersion,
                metric_name: 'response_length',
                metric_value: responseLength,
                context: {
                  question_length: question.length,
                  word_count: wordCount,
                  is_crisis: crisis.isCrisis,
                  qna_id: qnaRow.id
                }
              });
            } catch (perfErr) {
              console.error('Failed to track performance metrics:', perfErr);
            }
            
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
    if (anon && !user) {
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