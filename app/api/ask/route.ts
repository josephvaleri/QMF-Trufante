import { NextRequest } from "next/server";

export const runtime = "edge";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: NextRequest) {
  const { question, history = [] as Msg[] } = await req.json();
  
  // Debug logging
  console.log('API Request received:', { question, historyLength: history.length });
  console.log('Environment check:', {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasVectorStore: !!process.env.VECTOR_STORE_ID,
    hasSystemPrompt: !!process.env.SYSTEM_PROMPT
  });

  // Check if required environment variables are present
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is missing');
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Create enhanced system prompt with document context
  const enhancedSystemPrompt = `${process.env.SYSTEM_PROMPT || "You are a helpful assistant."}

You have access to comprehensive Question My Faith knowledge base including:
- Faith and spirituality guidance and Q&A
- Business formation and operational processes  
- Training materials for faith conversations
- Action definitions and procedures
- Agent conversation training content

Use this knowledge to provide thoughtful, well-informed responses that reference specific guidance, processes, or information when relevant.`;

  const input: Msg[] = [
    { role: "system", content: enhancedSystemPrompt },
    ...history,
    { role: "user", content: String(question || "").trim() }
  ];

  // First, let's try without the vector store to see if basic chat works
  const body = {
    model: "gpt-4o",
    messages: input,
    stream: true
  };

  console.log('Making OpenAI API request with body:', JSON.stringify(body, null, 2));
  
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  console.log('OpenAI API response status:', resp.status);

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error('OpenAI API error:', resp.status, errorText);
    return new Response(JSON.stringify({ 
      error: 'Failed to get response from AI',
      details: errorText,
      status: resp.status
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(resp.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

