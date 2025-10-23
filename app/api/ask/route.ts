import { NextRequest } from "next/server";

export const runtime = "edge";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: NextRequest) {
  const { question, history = [] as Msg[] } = await req.json();

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

  const body = {
    model: "gpt-4o",
    messages: input,
    stream: true
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return new Response(resp.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

