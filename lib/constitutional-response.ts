import OpenAI from 'openai';
import type { Msg } from '@/app/api/ask/route';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate constitutionally compliant response when violation is detected
 * This replaces the original response entirely (hard constraint enforcement)
 */
export async function generateConstitutionallyCompliantResponse(
  originalQuestion: string,
  violations: string[],
  conversationHistory: Msg[],
  masterSystemPrompt: string
): Promise<string> {
  const constraintPrompt = `${masterSystemPrompt}

CRITICAL: The previous response violated constitutional constraints by using forbidden phrases:
${violations.map(v => `- "${v}"`).join('\n')}

Generate a new response that:
1. Addresses the original question fully
2. Uses conversational, flowing paragraphs - NO numbered lists (1., 2., 3.) or bulleted lists (-, *, •)
3. Uses allowed/preferred language patterns:
   - "Here's how X works..."
   - "I can explain/clarify/outline..."
   - "Let me clarify the difference between..."
   - "If it helps to think about it practically..."
   - "If you want, I can outline..."
4. CRITICAL: Write conversationally in flowing paragraphs. Never use numbered or bulleted lists.
5. Avoids all constitutional violations:
   - No role claims (pastor/therapist/counselor)
   - No authority claims ("God says...", "Scripture requires...")
   - No dependency-forming language ("I'm here for you")
   - No therapeutic validation ("Your feelings are valid", "That sounds really hard")
   - No proactive faith initiation
   - NO numbered lists, bulleted lists, or "Here are steps/options..." formats
6. Maintains natural, helpful tone without dependency-forming or therapeutic language
7. Preserves all factual information from the original intent but presents it conversationally
8. Do NOT apologize for the rewrite

Original question: ${originalQuestion}

Generate the compliant response now:`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: constraintPrompt },
        ...conversationHistory.slice(-5), // Last 5 messages for context
        { role: 'user', content: originalQuestion },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const compliantResponse = response.choices[0]?.message?.content || '';
    
    // If replacement also violates, return fallback
    if (compliantResponse.includes('I\'m sorry') || 
        compliantResponse.includes('I\'m here') ||
        compliantResponse.toLowerCase().includes('feelings are valid')) {
      return generateFallbackResponse(originalQuestion);
    }

    return compliantResponse;
  } catch (error) {
    console.error('Error generating compliant response:', error);
    return generateFallbackResponse(originalQuestion);
  }
}

/**
 * Fallback response if replacement generation fails
 */
function generateFallbackResponse(originalQuestion: string): string {
  // Simple, neutral boundary message - no apology, no therapeutic framing
  return "I cannot provide that type of response. If you have questions about faith, church life, or belief that you'd like to discuss, I can help with those.";
}

