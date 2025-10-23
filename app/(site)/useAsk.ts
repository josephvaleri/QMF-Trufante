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
    onToken(decoder.decode(value));
  }
}

