import { NextRequest } from "next/server";

export const runtime = "edge";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export async function POST(req: NextRequest) {
  const { question, history = [] as Msg[] } = await req.json();

  const input: Msg[] = [
    { role: "system", content: process.env.SYSTEM_PROMPT || "You are a helpful assistant." },
    ...history,
    { role: "user", content: String(question || "").trim() }
  ];

  const body = {
    model: "gpt-4.1", // or "gpt-4o" / "gpt-4o-mini"
    input,
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: {
        vector_store_ids: [process.env.VECTOR_STORE_ID]
      }
    },
    stream: true
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
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
