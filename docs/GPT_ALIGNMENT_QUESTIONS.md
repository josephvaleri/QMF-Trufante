# Questions to Ask GPT About Constitutional Constraint Alignment

Copy and paste these questions into GPT to understand optimal alignment between the GPT source system and the QMF derived system.

---

## Question Set 1: Constraint Enforcement Method

**Question:**

You are a GPT-based conversational system that has been given constitutional constraints to avoid:
1. Acting as a therapist, pastor, counselor, or spiritual authority
2. Using dependency-forming language (e.g., "I'm here for you")
3. Using therapeutic language (e.g., "That sounds really hard", "Your feelings are valid")
4. Making authority claims (e.g., "God says", "Scripture requires")
5. Proactively initiating faith topics

Given these constraints:

A) How do you naturally avoid violations? Do you rely solely on prompt-level instructions, or is there post-hoc validation/checking of your responses?

B) Can you provide examples of phrases you naturally use that are helpful and informative but don't violate these constraints? For example:
   - How would you naturally say "I can help with information about X" without triggering a dependency-forming violation?
   - How would you provide clarification or explanation without sounding therapeutic?

C) When you need to ask a clarifying question, how do you phrase it so it's helpful but doesn't sound like permission-seeking escalation?

---

## Question Set 2: Tone and Quality Comparison

**Question:**

You are evaluating two systems with identical constitutional constraints and the same master system prompt:

**System A (GPT Source):** Responds naturally, maintains helpful tone, provides comprehensive answers, and rarely violates constraints.

**System B (QMF Derived):** Uses regex pattern matching to validate responses, blocks phrases like "I'm here to explain...", "I can help with...", and replaces violations with generated compliant responses.

Given this comparison:

A) What is the likely performance gap between System A and System B? Specifically:
   - Quality of responses
   - Naturalness of tone
   - Frequency of false positives (legitimate helpful phrases being blocked)
   - User experience differences

B) If System A naturally avoids violations through prompt-level alignment, what specific prompt language or structure helps achieve this? What should System B's prompt include to match System A's natural compliance?

C) What are examples of phrases that System B might incorrectly block that System A would naturally produce correctly? For example:
   - "I'm here to explain how prayer works..."
   - "I can help clarify the difference between..."
   - "Let me share what I know about..."

---

## Question Set 3: Optimal Constraint Strategy

**Question:**

You have a constitutional constraint system that must:
- Block: Role claims, dependency-forming language, therapeutic cadence, authority claims, proactive faith
- Allow: Helpful informational responses, natural clarification, appropriate warmth without emotional validation
- Preserve: GPT-like natural tone and quality

Given these requirements:

A) What is the optimal enforcement strategy?
   - Should constraints be enforced at prompt level only?
   - Should there be post-hoc validation? If so, what should be validated vs. what should be trusted to prompt alignment?
   - What patterns should be hard-blocked vs. context-checked?

B) For the phrase "I'm here to [verb]":
   - Which instances violate constitutional constraints? (e.g., "I'm here to support you")
   - Which instances are legitimate and helpful? (e.g., "I'm here to explain...", "I'm here to clarify...")
   - How can a system differentiate between these without false positives?

C) What prompt-level guidance would help you naturally produce responses that are helpful, warm, and informative while still maintaining constitutional boundaries? Provide specific examples of prompt language that would guide natural constraint-compliant responses.

---

## Question Set 4: Response Quality and Replacement Impact

**Question:**

A system generates a response using GPT with constitutional constraints in the prompt. The response is then checked using regex pattern matching. If a violation is detected, the response is replaced with a newly generated "compliant" response.

Given this process:

A) What is the likely impact on response quality when responses are replaced?
   - Does replacement maintain the same quality, tone, and helpfulness as the original?
   - Does replacement preserve the original intent and comprehensiveness?
   - What are the risks of replacement?

B) What would you recommend to minimize replacements while maintaining constraint compliance?
   - Should the prompt be enhanced to prevent violations in the first place?
   - Should validation be more permissive for informational phrases?
   - Should replacement only occur for clear violations (role claims, authority) vs. ambiguous phrases (helpful language)?

C) If you were designing a system to match GPT's natural constraint-compliant responses, would you prefer:
   - Option 1: Strong prompt-level guidance with minimal/no post-hoc validation
   - Option 2: Moderate prompt guidance with selective post-hoc validation (only for clear violations)
   - Option 3: Current approach: Prompt guidance + comprehensive regex validation + replacement
   
   Which option best matches how you naturally operate, and why?

---

## Question Set 5: Pattern Refinement and False Positives

**Question:**

A system uses regex patterns to detect constitutional violations. Current patterns include:

- `/\bI'?m\s+here\s+to\b/i` - Blocks "I'm here to [anything]"
- `/\bI\s+can\s+help\b/i` - Blocks "I can help"
- `/\bWould\s+you\s+like\s+to\s+share\s+more\b/i` - Blocks clarifying questions

These patterns are catching legitimate helpful phrases like:
- "I'm here to explain how faith works..."
- "I can help clarify the difference..."
- "Would you like me to elaborate on that point?"

A) How would you refine these patterns to:
   - Still catch true violations (e.g., "I'm here to support you emotionally")
   - Allow legitimate informational phrases
   - Minimize false positives

B) For each pattern, provide:
   - A refined regex that is more specific
   - Context that would help differentiate violations from legitimate use
   - Examples of phrases that should pass vs. fail

C) What alternative approach would you recommend beyond regex patterns? Should ambiguous phrases be checked with intent classification, or should the prompt be strengthened so fewer violations occur naturally?

---

## Question Set 6: Streaming and Performance

**Question:**

A system streams responses from GPT, then buffers the full response, validates it with regex patterns, and replaces it if violations are detected. This creates:
- Delay in streaming (waiting for full response)
- Potential user experience issues (replacement changes tone mid-stream)
- Performance overhead

A) How does streaming normally work in GPT systems? Do you validate during streaming or only after completion?

B) If you were to optimize this process:
   - Should validation happen during streaming (chunk-based) or only after completion?
   - What patterns could be checked early vs. what requires full context?
   - How would you balance early detection (faster replacement) vs. false positives from incomplete context?

C) If the prompt is strong enough that violations are rare, would it be better to:
   - Trust prompt alignment and validate only for auditing/logging (not replacement)?
   - Use lightweight chunk-based checks for clear violations only?
   - Buffer and validate comprehensively but minimize replacements through better prompt alignment?

---

## Usage Instructions

1. **Copy each question set separately** - Paste one set at a time into GPT for focused answers
2. **Provide context** - Before pasting, you may want to add: "You are a GPT system that has been given constitutional constraints. Answer these questions about how you naturally handle constraint compliance."
3. **Iterate** - Use the answers to refine your approach, then ask follow-up questions
4. **Compare answers** - If asking multiple GPT instances, compare their responses for consistency

---

## Expected Insights

From these questions, you should gain:

1. **Constraint enforcement strategy**: Whether GPT relies on prompt-level alignment vs. post-hoc validation
2. **Natural phrase usage**: Examples of helpful phrases GPT naturally uses that don't violate constraints
3. **False positive identification**: Which patterns incorrectly block legitimate helpful language
4. **Prompt optimization**: How to strengthen prompts to reduce violations naturally
5. **Validation strategy**: What should be validated vs. trusted to prompt alignment
6. **Performance optimization**: How to balance constraint compliance with response quality and speed

