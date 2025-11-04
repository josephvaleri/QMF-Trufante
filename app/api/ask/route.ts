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
  })).optional().default([]),
  session_id: z.string().uuid().optional()
});

export async function POST(req: NextRequest) {
  try {
    const { question, history, session_id } = schema.parse(await req.json());

    // Check for crisis situations FIRST (before moderation)
    const crisis = detectCrisis(question);
    
    // Check user input for inappropriate content
    const moderationResult = await moderationService.checkText(question);
    if (moderationResult.flagged) {
      console.log('Content flagged for moderation:', moderationResult);
      // Temporarily log instead of blocking to debug false positives
      console.warn('Moderation flagged content but allowing through for debugging:', {
        question,
        reason: moderationResult.reason,
        categories: moderationResult.categories
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
      console.warn('VECTOR_STORE_ID is missing - Vector Store features will not be available');
      // Continue without Vector Store - it's optional
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
    
    // Get model version details for enhanced context
    let modelVersionDetails = null;
    if (currentModelVersion) {
      const { data: modelVersionData } = await supa
        .from('model_versions')
        .select('training_data_count, performance_metrics, model_config')
        .eq('version', currentModelVersion)
        .eq('status', 'active')
        .single();
      
      modelVersionDetails = modelVersionData;
      console.log('Active model version details:', {
        version: currentModelVersion,
        training_data_count: modelVersionData?.training_data_count,
        vector_store_enabled: modelVersionData?.performance_metrics?.vector_store_enabled
      });
    }

    // Retrieve session context if session_id is provided and user is authenticated
    let sessionContext: Msg[] = [];
    if (session_id && user) {
      try {
        const { data: sessionMessages, error: sessionError } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', session_id)
          .order('created_at', { ascending: true })
          .limit(20); // Last 20 messages for context

        if (!sessionError && sessionMessages) {
          sessionContext = sessionMessages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content
          }));
        }
      } catch (error) {
        console.error('Error retrieving session context:', error);
        // Continue without session context
      }
    }

    // Create enhanced system prompt with model version awareness and Vector Store instructions
    const basePrompt = process.env.SYSTEM_PROMPT || "You are a helpful assistant for Question My Faith.";
    
    const vectorStoreNote = process.env.VECTOR_STORE_ID 
      ? `\n\nIMPORTANT: You have access to a comprehensive knowledge base through the file_search tool. When answering questions, you should search the knowledge base to provide accurate, informed responses based on the curated content available. Use the file_search tool when you need to reference specific information from the knowledge base.`
      : '';
    
    const trainingDataNote = modelVersionDetails?.training_data_count 
      ? `\n\nThis model has been trained on ${modelVersionDetails.training_data_count} curated Q&A pairs and knowledge sources.`
      : '';
    
    const enhancedSystemPrompt = `${basePrompt}

Remember: Provide thoughtful, comprehensive responses that fully address the user's question. Use calm, empathetic voice. Listen first, ask permission before offering spiritual insight. Be thorough but concise - aim for complete answers (typically 3-6 sentences, but adjust based on the complexity of the question).

Model Version: ${currentModelVersion}${trainingDataNote}${vectorStoreNote}`;

    // Use session context if available, otherwise use provided history
    const contextMessages = sessionContext.length > 0 ? sessionContext : history;

    const input: Msg[] = [
      { role: "system", content: enhancedSystemPrompt },
      ...contextMessages,
      { role: "user", content: String(question || "").trim() }
    ];

    // Get anonymous session if user is not authenticated
    let anon = cookieStore.get('qmf_anon_session')?.value ?? null;

    // Collect full response for DB storage
    let fullResponse = '';
    const encoder = new TextEncoder();
    
    // Generate AI response with Vector Store integration
    console.log('Making OpenAI request...');
    console.log('Vector Store ID:', process.env.VECTOR_STORE_ID ? `${process.env.VECTOR_STORE_ID.substring(0, 8)}...` : 'not configured');
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
          } else if (process.env.VECTOR_STORE_ID) {
            // Use Assistants API with Vector Store (required for Vector Store search)
            // Optimized for speed with caching and reduced history
            try {
              const startTime = Date.now();
              console.log('Using Assistants API with Vector Store...');
              
              // Get or create assistant with Vector Store (cache in database for speed)
              const assistantName = `QMF Assistant`;
              let assistantId: string | null = null;
              
              // Try to get cached assistant ID from database first (fastest)
              const { data: cachedAssistant } = await supa
                .from('system_config')
                .select('value')
                .eq('key', 'assistant_id')
                .single();
              
              if (cachedAssistant?.value) {
                assistantId = cachedAssistant.value;
                // Quick verify it exists (skip if it's clearly valid format)
                try {
                  await openai.beta.assistants.retrieve(assistantId);
                  console.log('Using cached assistant ID:', assistantId);
                } catch (e) {
                  // Assistant doesn't exist, clear cache and find/create new one
                  assistantId = null;
                  await supa.from('system_config').delete().eq('key', 'assistant_id');
                }
              }
              
              if (!assistantId) {
                // Try to find existing assistant (limit search to 10 for speed)
                const assistants = await openai.beta.assistants.list({ limit: 10 });
                const existingAssistant = assistants.data.find(a => 
                  a.name === assistantName && 
                  a.tool_resources?.file_search?.vector_store_ids?.includes(process.env.VECTOR_STORE_ID!)
                );
                
                if (existingAssistant) {
                  assistantId = existingAssistant.id;
                  console.log('Found existing assistant:', assistantId);
                  // Cache it for next time
                  await supa.from('system_config').upsert({
                    key: 'assistant_id',
                    value: assistantId,
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'key' });
                }
              }
              
              if (!assistantId) {
                // Create new assistant with Vector Store
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
                assistantId = assistant.id;
                console.log('Created new assistant with Vector Store:', assistantId);
                // Cache it for next time
                await supa.from('system_config').upsert({
                  key: 'assistant_id',
                  value: assistantId,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
              }
              
              const assistantTime = Date.now() - startTime;
              console.log(`Assistant setup took ${assistantTime}ms`);
              
              // Create thread with messages (limit history to last 3 messages for maximum speed)
              const recentMessages = contextMessages
                .filter(msg => msg.role !== "system") // Remove system messages (handled in assistant instructions)
                .slice(-3) // Only last 3 messages to maximize speed
                .map(msg => ({
                  role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
                  content: msg.content
                }))
                .concat([{
                  role: "user" as const,
                  content: String(question || "").trim()
                }]) as Array<{ role: "user" | "assistant"; content: string }>;
              
              const threadStartTime = Date.now();
              const thread = await openai.beta.threads.create({
                messages: recentMessages
              });
              console.log(`Thread creation took ${Date.now() - threadStartTime}ms`);
              
              // Run assistant with streaming (optimized for speed)
              const runStartTime = Date.now();
              const runStream = openai.beta.threads.runs.createAndStream(thread.id, {
                assistant_id: assistantId,
              });
              
              // Stream the assistant response immediately (no timeout - let it complete)
              let assistantResponse = '';
              let firstChunk = true;
              
              for await (const event of runStream) {
                if (event.event === 'thread.message.delta') {
                  const content = (event as any).data?.delta?.content?.[0]?.text?.value;
                  if (content) {
                    if (firstChunk) {
                      console.log(`First response chunk after ${Date.now() - runStartTime}ms`);
                      firstChunk = false;
                    }
                    assistantResponse += content;
                    // Stream immediately to user
                    const data = `data: ${JSON.stringify({
                      choices: [{
                        delta: { content: content }
                      }]
                    })}\n\n`;
                    controller.enqueue(encoder.encode(data));
                  }
                }
              }
              
              fullResponse = assistantResponse;
              console.log(`✅ Assistant response complete (total: ${Date.now() - startTime}ms, response length: ${assistantResponse.length} chars)`);
              
            } catch (assistantError: any) {
              console.error('Error using Assistants API, falling back to Chat Completions:', assistantError);
              // Fall through to Chat Completions below
              
              // Fallback to Chat Completions
              const stream = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: input,
                stream: true,
                temperature: 0.7,
                max_tokens: 500,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
              });
              
              for await (const chunk of stream) {
                if (chunk.choices[0]?.delta?.content) {
                  const content = chunk.choices[0].delta.content;
                  fullResponse += content;
                  const data = `data: ${JSON.stringify({
                    choices: [{
                      delta: { content: content }
                    }]
                  })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              }
            }
          } else {
            // Normal streaming from OpenAI Chat Completions (no Vector Store)
            const stream = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: input,
              stream: true,
              temperature: 0.7,
              max_tokens: 500,
              presence_penalty: 0.1,
              frequency_penalty: 0.1
            });
            
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
            
            // Save messages to session if session_id is provided and user is authenticated
            if (session_id && user) {
              try {
                // Save user message
                await supabase.from('chat_messages').insert({
                  session_id,
                  role: 'user',
                  content: question
                });

                // Save assistant message
                await supabase.from('chat_messages').insert({
                  session_id,
                  role: 'assistant',
                  content: fullResponse
                });

                // Update session timestamp
                await supabase
                  .from('chat_sessions')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', session_id);

                console.log('Messages saved to session:', session_id);
              } catch (sessionErr) {
                console.error('Failed to save messages to session:', sessionErr);
                // Continue even if session save fails
              }
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