export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function ask(
  question: string,
  history: ChatTurn[],
  onToken: (chunk: string) => void
) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history })
  });

  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6); // Remove 'data: ' prefix
        
        if (data === '[DONE]') {
          return; // Stream is complete
        }
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
            onToken(parsed.choices[0].delta.content);
          }
        } catch (e) {
          // Skip invalid JSON lines
          console.warn('Failed to parse SSE data:', data);
        }
      }
    }
  }
}

