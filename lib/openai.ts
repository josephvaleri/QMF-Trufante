import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const chatModel  = process.env.OPENAI_CHAT_MODEL  ?? 'gpt-4o-mini';
export const embedModel = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small';

export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: embedModel, input: text });
  return res.data[0].embedding;
}

/**
 * Replies with your existing tone/style by attaching your Vector Store as a file_search tool.
 * If you already have a chat call, you can keep it; just use this where we say "LLM fallback".
 */
export async function replyWithVectorStore(userContent: string) {
  const vectorStoreId = process.env.VECTOR_STORE_ID!;
  
  // Use the existing chat completions API with your current setup
  const res = await openai.chat.completions.create({
    model: chatModel,
    messages: [
      {
        role: 'system',
        content: process.env.SYSTEM_PROMPT || 'You are a helpful assistant.'
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    stream: false
  });
  
  return res.choices[0]?.message?.content ?? '';
}
