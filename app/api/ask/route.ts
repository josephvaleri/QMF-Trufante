import { NextRequest } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supaServer } from "@/lib/supabase/server";
import { moderationService } from "@/lib/moderation";
import { detectCrisis, crisisResources } from "@/lib/crisis";
import { z } from "zod";
import crypto from "crypto";
import { findSimilarCurated } from "@/lib/curated-qna";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getActiveModelConfig, type ModelConfig } from "@/lib/model-config";
import { rateLimit } from "@/lib/rate-limit";
import { 
  checkUserInputBoundaries, 
  validateResponseConstitution, 
  generateBoundaryRedirect,
  logConstitutionalViolation,
  quickViolationCheck,
  sha256 as hashPrompt
} from "@/lib/constitutional-constraints";
import { buildConstitutionalPrompt, getPromptHash } from "@/lib/constitutional-prompt";
import { generateConstitutionallyCompliantResponse } from "@/lib/constitutional-response";

export const runtime = "nodejs";

export type Msg = { role: "user" | "assistant" | "system"; content: string };

const schema = z.object({
  question: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  session_id: z.string().uuid().optional(),
});

// Helper: hash prompt to detect changes (using imported function from constitutional-constraints)

export async function POST(req: NextRequest) {
  try {
    const { question, history, session_id } = schema.parse(await req.json());

    // Rate limiting: 100 requests/hour per IP
    // Get IP from headers (x-forwarded-for for proxied requests, x-real-ip as fallback)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || realIp || 'unknown';
    await rateLimit(`ask:${ip}`, 100, 60 * 60 * 1000); // 100 requests per hour

    // Check for crisis situations FIRST (before moderation)
    const crisis = detectCrisis(question);

    // Check if constitutional constraints are enabled
    const constitutionalConstraintsEnabled = await isFeatureEnabled('constitutional_constraints_enabled');
    
    if (constitutionalConstraintsEnabled) {
      console.log('✅ Constitutional constraints ENABLED');
    } else {
      console.log('⚠️ Constitutional constraints DISABLED');
    }

    // Constitutional constraints: Check user input boundaries (soft boundary)
    // This runs after crisis detection but before moderation
    // Constitutional validation runs AFTER moderation but BEFORE response streaming (hard constraints)
    if (constitutionalConstraintsEnabled) {
      const boundaryCheck = checkUserInputBoundaries(question);
      if (boundaryCheck.isOutOfBounds && boundaryCheck.reason) {
        // Soft redirect - stream boundary message instead of processing
        const redirectMessage = generateBoundaryRedirect(boundaryCheck);
        if (redirectMessage) {
          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              const chunks = redirectMessage.split(" ");
              for (const chunk of chunks) {
                const data = `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk + " " } }],
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
                await new Promise((resolve) => setTimeout(resolve, 20));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          });
        }
      }
    }

    // Check user input for inappropriate content
    const moderationResult = await moderationService.checkText(question);
    if (moderationResult.flagged) {
      console.log("Content flagged for moderation:", moderationResult);
      // Temporarily log instead of blocking to debug false positives
      console.warn("Moderation flagged content but allowing through for debugging:", {
        question,
        reason: moderationResult.reason,
        categories: moderationResult.categories,
      });
    }

    // Debug logging
    console.log("API Request received:", { question, historyLength: history.length });
    console.log("Environment check:", {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasVectorStore: !!process.env.VECTOR_STORE_ID,
      hasSystemPrompt: !!process.env.SYSTEM_PROMPT,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    // Check if required environment variables are present
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ✅ A) Fail fast if SYSTEM_PROMPT is missing/misconfigured
    if (!process.env.SYSTEM_PROMPT || !process.env.SYSTEM_PROMPT.trim()) {
      console.error("SYSTEM_PROMPT is missing");
      return new Response(JSON.stringify({ error: "SYSTEM_PROMPT missing in environment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.VECTOR_STORE_ID) {
      console.warn("VECTOR_STORE_ID is missing - Vector Store features will not be available");
      // Continue without Vector Store - it's optional
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("Auth check result:", { user: !!user, authError });

    const supa = supaServer();

    // Get active model configuration (includes version and runtime settings)
    const modelConfig = await getActiveModelConfig();
    const currentModelVersion = modelConfig.version;

    // Get model version details for enhanced context (metadata only, not runtime config)
    let modelVersionDetails: any = null;
    const { data: modelVersionData } = await supa
      .from("model_versions")
      .select("training_data_count, performance_metrics, model_config")
      .eq("version", currentModelVersion)
      .eq("status", "active")
      .single();

    modelVersionDetails = modelVersionData;
    console.log("Active model version details:", {
      version: currentModelVersion,
      training_data_count: modelVersionData?.training_data_count,
      vector_store_enabled: modelVersionData?.performance_metrics?.vector_store_enabled,
    });

    // Retrieve session context if session_id is provided and user is authenticated
    let sessionContext: Msg[] = [];
    if (session_id && user) {
      try {
        const { data: sessionMessages, error: sessionError } = await supabase
          .from("chat_messages")
          .select("role, content")
          .eq("session_id", session_id)
          .order("created_at", { ascending: true })
          .limit(20); // Last 20 messages for context

        if (!sessionError && sessionMessages) {
          sessionContext = sessionMessages.map((msg) => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          }));
        }
      } catch (error) {
        console.error("Error retrieving session context:", error);
        // Continue without session context
      }
    }

    // CRITICAL (Section A): Load master system prompt verbatim - must be first instruction
    const masterSystemPrompt = process.env.SYSTEM_PROMPT!.trim();
    
    // Use vector_store_id from model config, fallback to env var
    const vectorStoreId = modelConfig.vector_store_id || process.env.VECTOR_STORE_ID || null;
    const vectorStoreNote = vectorStoreId
      ? `\n\nIMPORTANT: You have access to a comprehensive knowledge base through the file_search tool. When answering questions, you should search the knowledge base to provide accurate, informed responses based on the curated content available. Use the file_search tool when you need to reference specific information from the knowledge base.`
      : "";

    // Use session context if available, otherwise use provided history
    const contextMessages = sessionContext.length > 0 ? sessionContext : history;

    // Build system prompt based on whether constitutional constraints are enabled
    let enhancedSystemPrompt: string;
    let similarCurated: Array<{ question: string; answer: string }> | undefined = undefined;

    if (constitutionalConstraintsEnabled) {
      // Constitutional constraints enabled - use constitutional prompt builder
      // Get curated guidance if feature flag is enabled
      const curatedGuidanceEnabled = await isFeatureEnabled('curated_guidance_enabled');
      if (curatedGuidanceEnabled) {
        try {
          similarCurated = await findSimilarCurated(question, 5, 0.7) || undefined;
        } catch (error) {
          console.error('Error fetching curated guidance (non-blocking):', error);
        }
      }

      // Build constitutional prompt (master prompt must be first - Section A)
      enhancedSystemPrompt = buildConstitutionalPrompt(
        masterSystemPrompt,
        currentModelVersion,
        modelVersionDetails?.training_data_count,
        vectorStoreNote || undefined,
        similarCurated,
        contextMessages // For detecting user-initiated faith topics
      );

      // Verify master prompt is still first (Section A verification)
      if (!enhancedSystemPrompt.startsWith(masterSystemPrompt)) {
        console.error('CRITICAL: Constitutional prompt does not start with master prompt (Section A violation)');
        throw new Error('System prompt authority violation - master prompt must be first');
      }
    } else {
      // Legacy mode - build prompt without constitutional constraints
      const trainingDataNote = modelVersionDetails?.training_data_count
        ? `\n\nThis model has been trained on ${modelVersionDetails.training_data_count} curated Q&A pairs and knowledge sources.`
        : "";

      enhancedSystemPrompt = `${masterSystemPrompt}

Remember:
- Provide thoughtful, comprehensive responses that fully address the user's question.
- Use a calm, empathetic voice.
- Listen first and ask permission before offering spiritual insight.
- Be thorough but concise (typically 3–6 sentences, adjust for complexity).

Model Version: ${currentModelVersion}${trainingDataNote}${vectorStoreNote}`;

      // Add curated guidance if feature flag is enabled
      const curatedGuidanceEnabled = await isFeatureEnabled('curated_guidance_enabled');
      if (curatedGuidanceEnabled) {
        try {
          similarCurated = await findSimilarCurated(question, 5, 0.7) || undefined;
          if (similarCurated && similarCurated.length >= 2) {
            const guidancePairs = similarCurated.slice(0, 5);
            const guidanceBlock = `\n\n=== Reviewed Guidance (similar questions) ===\n${guidancePairs
              .map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`)
              .join('\n\n')}\n===\n\nUse these examples as guidance for tone and approach, but do not quote them verbatim unless directly helpful.`;
            
            enhancedSystemPrompt = guidanceBlock + '\n\n' + enhancedSystemPrompt;
          }
        } catch (error) {
          console.error('Error fetching curated guidance (non-blocking):', error);
        }
      }
    }

    const input: Msg[] = [
      { role: "system", content: enhancedSystemPrompt },
      ...contextMessages,
      { role: "user", content: String(question || "").trim() },
    ];

    // Get anonymous session if user is not authenticated
    let anon = cookieStore.get("qmf_anon_session")?.value ?? null;

    // Collect full response for DB storage
    let fullResponse = "";
    const encoder = new TextEncoder();

    // Generate AI response with Vector Store integration
    console.log("Making OpenAI request...");
    console.log("Model config:", {
      version: modelConfig.version,
      model: modelConfig.openai_model,
      temperature: modelConfig.temperature,
      vector_store_id: modelConfig.vector_store_id ? `${modelConfig.vector_store_id.substring(0, 8)}...` : "not configured",
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Handle crisis response
          let crisisResponse = "";
          if (crisis.isCrisis) {
            const res = crisisResources("US");
            crisisResponse = `${res.title}\n\n${res.lines
              .map((l) => `- ${l}`)
              .join("\n")}\n\n${res.footer}\n\n_I'm not a substitute for professional help, but I care about your safety._`;
            fullResponse = crisisResponse;

            // Stream the crisis response
            const chunks = crisisResponse.split(" ");
            for (const chunk of chunks) {
              const data = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: { content: chunk + " " },
                  },
                ],
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          } else if (vectorStoreId) {
            // Use Assistants API with Vector Store (required for Vector Store search)
            // Version-aware assistant caching
            try {
              const startTime = Date.now();
              console.log("Using Assistants API with Vector Store...");

              // Get or create assistant + update cached instructions when prompt changes
              const assistantName = `QMF Assistant v${modelConfig.version}`;
              let assistantId: string | null = modelConfig.assistant_id;
              const desiredInstructionsHash = hashPrompt(enhancedSystemPrompt);

              // If cached assistant ID exists, verify it's valid and update if needed
              if (assistantId) {
                try {
                  await openai.beta.assistants.retrieve(assistantId);

                  // Check if instructions hash changed
                  if (modelConfig.prompt_hash !== desiredInstructionsHash) {
                    console.log("Assistant instructions changed; updating assistant...");
                    await openai.beta.assistants.update(assistantId, {
                      instructions: enhancedSystemPrompt,
                    });

                    // Update prompt_hash in model_versions
                    await supa
                      .from("model_versions")
                      .update({ prompt_hash: desiredInstructionsHash })
                      .eq("version", modelConfig.version);
                  } else {
                    console.log("Cached assistant instructions hash matches; no update needed.");
                  }

                  console.log("Using cached assistant ID:", assistantId);
                } catch (e) {
                  console.warn("Cached assistant invalid; will create/find new one.");
                  assistantId = null;
                }
              }

              // If no cached assistant, try to find an existing one
              if (!assistantId && vectorStoreId) {
                const assistants = await openai.beta.assistants.list({ limit: 10 });
                const existingAssistant = assistants.data.find(
                  (a) =>
                    a.name === assistantName &&
                    a.tool_resources?.file_search?.vector_store_ids?.includes(vectorStoreId)
                );

                if (existingAssistant) {
                  assistantId = existingAssistant.id;
                  console.log("Found existing assistant:", assistantId);

                  // Update instructions if needed
                  await openai.beta.assistants.update(assistantId, {
                    instructions: enhancedSystemPrompt,
                  });

                  // Update model_versions with assistant_id and prompt_hash
                  await supa
                    .from("model_versions")
                    .update({
                      assistant_id: assistantId,
                      prompt_hash: desiredInstructionsHash,
                    })
                    .eq("version", modelConfig.version);
                }
              }

              // If still no assistant, create one
              if (!assistantId && vectorStoreId) {
                const assistant = await openai.beta.assistants.create({
                  name: assistantName,
                  instructions: enhancedSystemPrompt,
                  model: modelConfig.openai_model,
                  tools: [{ type: "file_search" }],
                  tool_resources: {
                    file_search: {
                      vector_store_ids: [vectorStoreId],
                    },
                  },
                  temperature: modelConfig.temperature,
                  response_format: { type: "text" },
                });

                assistantId = assistant.id;
                console.log("Created new assistant with Vector Store:", assistantId);

                // Store assistant_id and prompt_hash in model_versions
                await supa
                  .from("model_versions")
                  .update({
                    assistant_id: assistantId,
                    prompt_hash: desiredInstructionsHash,
                  })
                  .eq("version", modelConfig.version);
              }

              // Use the assistant_id we found/created
              if (!assistantId) {
                throw new Error("Failed to get or create assistant");
              }

              const assistantTime = Date.now() - startTime;
              console.log(`Assistant setup took ${assistantTime}ms`);

              // Create thread with messages (limit history window from model config)
              const recentMessages = contextMessages
                .filter((msg) => msg.role !== "system") // Remove system messages (handled in assistant instructions)
                .slice(-modelConfig.history_window) // Limit to history window from config
                .map((msg) => ({
                  role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
                  content: msg.content,
                }))
                .concat([
                  {
                    role: "user" as const,
                    content: String(question || "").trim(),
                  },
                ]) as Array<{ role: "user" | "assistant"; content: string }>;

              const threadStartTime = Date.now();
              const thread = await openai.beta.threads.create({
                messages: recentMessages,
              });
              console.log(`Thread creation took ${Date.now() - threadStartTime}ms`);

              // Run assistant with streaming (optimized for speed)
              const runStartTime = Date.now();
              const runStream = openai.beta.threads.runs.createAndStream(thread.id, {
                assistant_id: assistantId!,
              });

              // Buffer response for constitutional validation (hard constraint enforcement)
              // Section H: No post-processing except violation replacement
              // Phase 3: Add chunk-based early detection for never-allowed phrases
              let assistantResponse = "";
              let firstChunk = true;
              const responseChunks: string[] = [];
              let earlyWarning = false;
              let replacementPromise: Promise<string | null> | null = null;

              for await (const event of runStream) {
                if (event.event === "thread.message.delta") {
                  const content = (event as any).data?.delta?.content?.[0]?.text?.value;
                  if (content) {
                    if (firstChunk) {
                      console.log(`First response chunk after ${Date.now() - runStartTime}ms`);
                      firstChunk = false;
                    }
                    assistantResponse += content;
                    responseChunks.push(content);
                    
                    // Quick check every 200 chars for never-allowed phrases only
                    if (constitutionalConstraintsEnabled && assistantResponse.length % 200 < content.length) {
                      const quickCheck = quickViolationCheck(assistantResponse);
                      if (quickCheck.highConfidenceViolation && !replacementPromise) {
                        earlyWarning = true;
                        console.log('Early warning: High-confidence violation detected during streaming');
                        // Start replacement generation in parallel (don't await)
                        replacementPromise = generateConstitutionallyCompliantResponse(
                          question,
                          quickCheck.detectedPatterns,
                          contextMessages,
                          masterSystemPrompt
                        ).catch(err => {
                          console.error('Error in early replacement generation:', err);
                          return null;
                        });
                      }
                    }
                  }
                }
              }

              // Raw model response collected - validate before streaming (hard constraint)
              let responseToStream = assistantResponse;
              const rawResponse = assistantResponse; // Store raw for platform interference check

              if (constitutionalConstraintsEnabled) {
                const validation = validateResponseConstitution(assistantResponse);
                
                console.log('Constitutional validation:', {
                  violated: validation.violated,
                  violationCount: validation.violations.length,
                  categories: validation.categories,
                  responseLength: assistantResponse.length,
                  earlyWarning,
                });
                
                if (validation.violated && validation.severity === 'block') {
                  console.warn('Constitutional violation detected in streaming response - generating replacement');
                  
                  // Use replacement if already generating, otherwise start now
                  try {
                    let replacementResponse: string;
                    if (replacementPromise) {
                      // Already generating - await it
                      const earlyReplacement = await replacementPromise;
                      if (earlyReplacement) {
                        replacementResponse = earlyReplacement;
                      } else {
                        // Early replacement failed, generate new one
                        replacementResponse = await generateConstitutionallyCompliantResponse(
                          question,
                          validation.violations,
                          contextMessages,
                          masterSystemPrompt
                        );
                      }
                    } else {
                      // Start replacement now
                      replacementResponse = await generateConstitutionallyCompliantResponse(
                        question,
                        validation.violations,
                        contextMessages,
                        masterSystemPrompt
                      );
                    }
                    
                    responseToStream = replacementResponse;
                    
                    // Log violation
                    await logConstitutionalViolation(
                      question,
                      rawResponse,
                      validation.violations,
                      replacementResponse,
                      undefined, // qnaId not yet created
                      currentModelVersion
                    );
                  } catch (replacementError) {
                    console.error('Error generating compliant response:', replacementError);
                    // Fallback: use boundary message
                    responseToStream = generateBoundaryRedirect({ 
                      isOutOfBounds: true, 
                      category: 'other' 
                    });
                  }
                }
              }

              // Stream the validated/replaced response
              if (responseToStream !== assistantResponse) {
                // Response was replaced - stream replacement word by word
                const chunks = responseToStream.split(" ");
                for (const chunk of chunks) {
                  const data = `data: ${JSON.stringify({
                    choices: [{ delta: { content: chunk + " " } }],
                  })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                  await new Promise((resolve) => setTimeout(resolve, 20));
                }
              } else {
                // Stream original chunks (no violation)
                for (const chunk of responseChunks) {
                  const data = `data: ${JSON.stringify({
                    choices: [{ delta: { content: chunk } }],
                  })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              }

              fullResponse = responseToStream; // Use validated/replaced response
              
              // Platform interference check (Section H): Log if raw response differs from streamed
              if (constitutionalConstraintsEnabled && rawResponse !== responseToStream) {
                console.log('Platform interference check: Response replaced due to constitutional violation');
                // This is expected when violations occur - log for audit
              }
              console.log(
                `✅ Assistant response complete (total: ${Date.now() - startTime}ms, response length: ${assistantResponse.length} chars)`
              );
            } catch (assistantError: any) {
              console.error("Error using Assistants API, falling back to Chat Completions:", assistantError);

              // Fallback to Chat Completions
              // Buffer for constitutional validation with early detection
              let fallbackResponse = "";
              const fallbackChunks: string[] = [];
              let fallbackEarlyWarning = false;
              let fallbackReplacementPromise: Promise<string | null> | null = null;
              
              const stream = await openai.chat.completions.create({
                model: modelConfig.openai_model,
                messages: input,
                stream: true,
                temperature: modelConfig.temperature,
                max_tokens: 800, // Increased for more comprehensive responses
                presence_penalty: 0.1,
                frequency_penalty: 0.1,
              });

              for await (const chunk of stream) {
                if (chunk.choices[0]?.delta?.content) {
                  const content = chunk.choices[0].delta.content;
                  fallbackResponse += content;
                  fallbackChunks.push(content);
                  
                  // Quick check every 200 chars for never-allowed phrases only
                  if (constitutionalConstraintsEnabled && fallbackResponse.length % 200 < content.length) {
                    const quickCheck = quickViolationCheck(fallbackResponse);
                    if (quickCheck.highConfidenceViolation && !fallbackReplacementPromise) {
                      fallbackEarlyWarning = true;
                      console.log('Early warning: High-confidence violation detected in fallback streaming');
                      // Start replacement generation in parallel (don't await)
                      fallbackReplacementPromise = generateConstitutionallyCompliantResponse(
                        question,
                        quickCheck.detectedPatterns,
                        contextMessages,
                        masterSystemPrompt
                      ).catch(err => {
                        console.error('Error in early fallback replacement generation:', err);
                        return null;
                      });
                    }
                  }
                }
              }

              // Validate fallback response
              let fallbackToStream = fallbackResponse;
              const rawFallback = fallbackResponse;

              if (constitutionalConstraintsEnabled) {
                const validation = validateResponseConstitution(fallbackResponse);
                
                if (validation.violated && validation.severity === 'block') {
                  console.warn('Constitutional violation in fallback response - generating replacement');
                  try {
                    let replacement: string;
                    if (fallbackReplacementPromise) {
                      // Already generating - await it
                      const earlyReplacement = await fallbackReplacementPromise;
                      if (earlyReplacement) {
                        replacement = earlyReplacement;
                      } else {
                        // Early replacement failed, generate new one
                        replacement = await generateConstitutionallyCompliantResponse(
                          question,
                          validation.violations,
                          contextMessages,
                          masterSystemPrompt
                        );
                      }
                    } else {
                      // Start replacement now
                      replacement = await generateConstitutionallyCompliantResponse(
                        question,
                        validation.violations,
                        contextMessages,
                        masterSystemPrompt
                      );
                    }
                    fallbackToStream = replacement;
                    
                    await logConstitutionalViolation(
                      question,
                      rawFallback,
                      validation.violations,
                      replacement,
                      undefined,
                      currentModelVersion
                    );
                  } catch (replacementError) {
                    console.error('Error generating compliant fallback:', replacementError);
                    fallbackToStream = generateBoundaryRedirect({ 
                      isOutOfBounds: true, 
                      category: 'other' 
                    });
                  }
                }
              }

              // Stream validated/replaced fallback
              if (fallbackToStream !== fallbackResponse) {
                const chunks = fallbackToStream.split(" ");
                for (const chunk of chunks) {
                  const data = `data: ${JSON.stringify({
                    choices: [{ delta: { content: chunk + " " } }],
                  })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                  await new Promise((resolve) => setTimeout(resolve, 20));
                }
              } else {
                for (const chunk of fallbackChunks) {
                  const data = `data: ${JSON.stringify({
                    choices: [{ delta: { content: chunk } }],
                  })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              }

              fullResponse = fallbackToStream;
            }
          } else {
            // Normal streaming from OpenAI Chat Completions (no Vector Store)
            // Buffer for constitutional validation with early detection
            let chatResponse = "";
            const chatChunks: string[] = [];
            let chatEarlyWarning = false;
            let chatReplacementPromise: Promise<string | null> | null = null;
            
            const stream = await openai.chat.completions.create({
              model: modelConfig.openai_model,
              messages: input,
              stream: true,
              temperature: modelConfig.temperature,
              max_tokens: 800, // Increased for more comprehensive responses
              presence_penalty: 0.1,
              frequency_penalty: 0.1,
            });

            for await (const chunk of stream) {
              if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                chatResponse += content;
                chatChunks.push(content);
                
                // Quick check every 200 chars for never-allowed phrases only
                if (constitutionalConstraintsEnabled && chatResponse.length % 200 < content.length) {
                  const quickCheck = quickViolationCheck(chatResponse);
                  if (quickCheck.highConfidenceViolation && !chatReplacementPromise) {
                    chatEarlyWarning = true;
                    console.log('Early warning: High-confidence violation detected in chat streaming');
                    // Start replacement generation in parallel (don't await)
                    chatReplacementPromise = generateConstitutionallyCompliantResponse(
                      question,
                      quickCheck.detectedPatterns,
                      contextMessages,
                      masterSystemPrompt
                    ).catch(err => {
                      console.error('Error in early chat replacement generation:', err);
                      return null;
                    });
                  }
                }
              }
            }

            // Validate chat response
            let chatToStream = chatResponse;
            const rawChat = chatResponse;

            if (constitutionalConstraintsEnabled) {
              const validation = validateResponseConstitution(chatResponse);
              
              if (validation.violated && validation.severity === 'block') {
                console.warn('Constitutional violation in chat response - generating replacement');
                try {
                  let replacement: string;
                  if (chatReplacementPromise) {
                    // Already generating - await it
                    const earlyReplacement = await chatReplacementPromise;
                    if (earlyReplacement) {
                      replacement = earlyReplacement;
                    } else {
                      // Early replacement failed, generate new one
                      replacement = await generateConstitutionallyCompliantResponse(
                        question,
                        validation.violations,
                        contextMessages,
                        masterSystemPrompt
                      );
                    }
                  } else {
                    // Start replacement now
                    replacement = await generateConstitutionallyCompliantResponse(
                      question,
                      validation.violations,
                      contextMessages,
                      masterSystemPrompt
                    );
                  }
                  chatToStream = replacement;
                  
                  await logConstitutionalViolation(
                    question,
                    rawChat,
                    validation.violations,
                    replacement,
                    undefined,
                    currentModelVersion
                  );
                } catch (replacementError) {
                  console.error('Error generating compliant chat response:', replacementError);
                  chatToStream = generateBoundaryRedirect({ 
                    isOutOfBounds: true, 
                    category: 'other' 
                  });
                }
              }
            }

            // Stream validated/replaced chat response
            if (chatToStream !== chatResponse) {
              const chunks = chatToStream.split(" ");
              for (const chunk of chunks) {
                const data = `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk + " " } }],
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
                await new Promise((resolve) => setTimeout(resolve, 20));
              }
            } else {
              for (const chunk of chatChunks) {
                const data = `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk } }],
                })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }

            fullResponse = chatToStream;
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          // Response has been validated and replaced if needed during streaming
          // fullResponse now contains the validated/replaced response
          // Platform interference check: raw response should match streamed except for violations
          let qnaId: number | undefined = undefined;

          // NOW save to database AFTER stream completes
          console.log("Stream complete, saving to database...");

          // Create or verify anonymous session if user is not authenticated
          if (!user && !anon) {
            // No cookie - create new session
            const { data: anonSession, error: anonErr } = await supa
              .from("anon_sessions")
              .insert({})
              .select("session_id")
              .single();

            if (anonSession && !anonErr) {
              anon = anonSession.session_id;
              console.log("Created new anonymous session:", anon);
            } else {
              console.error("Failed to create anonymous session:", anonErr);
              anon = null;
            }
          }

          // Persist Q&A row
          console.log("Attempting to insert Q&A:", {
            user_id: user?.id ?? null,
            anon_session_id: user ? null : anon,
            user_question: question,
            assistant_answer: fullResponse?.substring(0, 100) + "...",
          });

          const { data: qnaRow, error: insErr } = await supa
            .from("qna")
            .insert({
              user_id: user?.id ?? null,
              anon_session_id: user ? null : anon,
              user_question: question,
              assistant_answer: fullResponse, // Use validated/replaced response
            })
            .select("id")
            .single();

          if (insErr || !qnaRow) {
            console.error("Failed to insert Q&A:", insErr);
            console.error("Auth user:", user);
            console.error("Anon session:", anon);
          } else {
            qnaId = qnaRow.id;
            console.log("Successfully inserted Q&A with ID:", qnaRow.id);

            // Update violation log with qnaId if violation was detected (violations already logged during streaming)
            // The violation was logged with replacement response, now link to qnaId
            if (constitutionalConstraintsEnabled && !crisis.isCrisis) {
              try {
                const supa = supaServer();
                // Update most recent violation log for this question with qnaId
                await supa
                  .from('constitutional_violations')
                  .update({ qna_id: qnaId })
                  .eq('question', question)
                  .is('qna_id', null)
                  .order('detected_at', { ascending: false })
                  .limit(1);
              } catch (updateError) {
                console.error('Error updating violation log with qnaId:', updateError);
              }
            }

            // Track model performance metrics
            try {
              const responseLength = fullResponse.length;
              const wordCount = fullResponse.split(" ").length;

              await supa.from("model_performance").insert({
                model_version: currentModelVersion,
                metric_name: "response_length",
                metric_value: responseLength,
                context: {
                  question_length: question.length,
                  word_count: wordCount,
                  is_crisis: crisis.isCrisis,
                  qna_id: qnaRow.id,
                },
              });
            } catch (perfErr) {
              console.error("Failed to track performance metrics:", perfErr);
            }

            // Save messages to session if session_id is provided and user is authenticated
            // Section F Compliance: Only store role and content - no emotional states, sentiment, or vulnerability tagging
            if (session_id && user) {
              try {
                await supabase.from("chat_messages").insert({
                  session_id,
                  role: "user",
                  content: question,
                  // No emotional_state, sentiment, or vulnerability fields (Section F)
                });

                await supabase.from("chat_messages").insert({
                  session_id,
                  role: "assistant",
                  content: fullResponse,
                  // No emotional_state, sentiment, or vulnerability fields (Section F)
                });

                await supabase
                  .from("chat_sessions")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", session_id);

                console.log("Messages saved to session:", session_id);
              } catch (sessionErr) {
                console.error("Failed to save messages to session:", sessionErr);
              }
            }

            // Queue for moderation
            try {
              const autoFlags = crisis.isCrisis
                ? {
                    crisis_detected: true,
                    category: crisis.category,
                    matches: crisis.matches,
                  }
                : null;

              await supa.from("moderation_queue").insert({
                qna_id: qnaRow.id,
                auto_flags: autoFlags,
                source: crisis.isCrisis ? "detector:crisis" : "assistants:file_search",
              });
            } catch (err) {
              console.error("Failed to insert moderation queue:", err);
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    };

    // Set anonymous session cookie if needed
    if (anon && !user) {
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      headers["Set-Cookie"] = `qmf_anon_session=${anon}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secureFlag}`;
    }

    return new Response(readable, { headers });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
