import crypto from 'crypto';
import { supaServer } from './supabase/server';

export interface BoundaryCheck {
  isOutOfBounds: boolean;
  reason?: string;
  category?: 'proactive-faith' | 'authority-claim' | 'interfaith-promotion' | 'counseling' | 'therapeutic' | 'other';
}

export interface ConstraintViolation {
  violated: boolean;
  violations: string[];
  severity: 'block' | 'warning';
  categories: string[];
}

// Comprehensive forbidden phrase patterns (Section E from checklist)

// Allowed informational patterns (checked first - exempt from validation)
const ALLOWED_INFORMATIONAL_PATTERNS = [
  /\bI'?m\s+here\s+to\s+(explain|clarify|outline|summarize|compare|list|describe|define)\b/i,
  /\bI\s+can\s+help\s+(explain|clarify|outline|draft|compare|list|summarize|describe|define)\b/i,
  /\bI\s+can\s+(explain|clarify|outline|summarize|compare|list|describe|define)\b/i,
  /\bHere'?s\s+how\s+it\s+works\b/i,
  /\bHere\s+are\s+(a\s+few\s+)?(options|steps|ways|approaches)\b/i,
  /\bHere'?s\s+(what|the\s+information|a\s+checklist|a\s+summary)\b/i,
  /\bLet\s+me\s+(clarify|explain|outline|summarize)\b/i,
  /\bCommon\s+approaches\s+include\b/i,
  /\bA\s+practical\s+way\s+to\s+think\s+about\s+it\s+is\b/i,
  /\bOne\s+way\s+to\s+evaluate\s+that\s+is\b/i,
];

// Allowed clarifying question patterns (pragmatic, not emotional)
const ALLOWED_CLARIFYING_PATTERNS = [
  /\b(Would\s+you\s+like|Do\s+you\s+want)\s+(the\s+)?(short|detailed|brief)\s+(version|steps|explanation)\??\b/i,
  /\b(Which|What)\s+(platform|version|option|approach)\s+(are\s+you\s+using|do\s+you\s+prefer|would\s+you\s+like)\??\b/i,
  /\bWhen\s+you\s+say\s+['"]([^'"]+)['"],\s+do\s+you\s+mean\s+(A|B|X|Y)\??\b/i,
];

// Dependency-Forming Language (targeted - only emotional/support context)
const DEPENDENCY_PATTERNS = [
  /\bI'?m\s+here\s+to\s+(support|comfort|be\s+there|listen|walk\s+with|help\s+you\s+through|get\s+you\s+through|be\s+with)\s+(you|with\s+you)\b/i,
  /\bI'?m\s+here\s+for\s+you\b/i,
  /\bI'?m\s+here\s+with\s+you\b/i,
  /\bI'?ll\s+be\s+here\s+for\s+you\b/i,
  /\bI'?ll\s+support\s+you\b/i,
  /\byou\s+can\s+always\s+come\s+to\s+me\b/i,
  /\byou'?re\s+not\s+alone\s+here\b/i,
  /\blet'?s\s+walk\s+through\s+this\s+together\b/i,
  /\bI\s+can\s+help\s+(you\s+)?(through|cope|deal\s+with|process|heal)\b/i, // Emotional support context
  /\b(you\s+can|you're\s+always\s+welcome\s+to)\s+(talk|come)\s+(to|back\s+to)\s+me\b/i,
];

// Authority Claims
const AUTHORITY_PATTERNS = [
  /\bGod\s+says\b/i,
  /\bScripture\s+(requires|says|tells|commands)\b/i,
  /\byou\s+must\b/i,
  /\bScripture\s+tells\s+us\b/i,
  /\bGod\s+may\s+be\s+using\s+this\b/i,
  /\b(the\s+)?Bible\s+(says|requires|commands|tells)\b/i,
  /\bGod\s+is\s+(telling|calling|asking)\s+you\b/i,
];

// Therapeutic Language
const THERAPEUTIC_PATTERNS = [
  /\bIt\s+sounds\s+like\s+you'?re\s+(feeling|experiencing|going\s+through)\b/i,
  /\blet'?s\s+work\s+through\s+this\b/i,
  /\bI'?m\s+sorry\s+you'?re\s+feeling\s+this\s+way\b/i,
  /\bThat\s+sounds\s+really\s+hard\b/i,
  /\bYour\s+feelings\s+are\s+valid\b/i,
  /\bIt'?s\s+completely\s+understandable\s+to\s+feel\b/i,
  /\bI\s+hear\s+you\s+when\s+you\s+say\b/i,
  /\bIt\s+sounds\s+like\s+you'?re\s+going\s+through\b/i,
  /\bThat\s+must\s+be\s+(difficult|challenging|hard)\b/i,
];

// Formal/Institutional Language (sounds like textbook or institution, not conversational)
const FORMAL_INSTITUTIONAL_PATTERNS = [
  /\bIn\s+summary\b/i,
  /\bTo\s+summarize\b/i,
  /\bIn\s+conclusion\b/i,
  /\bTo\s+conclude\b/i,
  /\bIn\s+essence\b/i,
  /\bIn\s+short\b/i,
];

// Permission-Seeking Escalation (only therapy-shaped invites, not pragmatic questions)
const PERMISSION_SEEKING_PATTERNS = [
  /\bWould\s+you\s+like\s+to\s+(share\s+more|open\s+up|talk\s+about\s+(your\s+)?feelings|explore\s+(that|this|it)|dive\s+deeper)\s*(more|further|into)?\??\b/i,
  /\bCan\s+you\s+tell\s+me\s+more\s+about\s+that\??\b/i,
  /\bWould\s+you\s+like\s+to\s+explore\s+(that|this|it)\s+(further|more)\??\b/i,
  /\bHow\s+does\s+that\s+make\s+you\s+feel\??\b/i,
  /\bIf\s+you'?re\s+open\s+to\s+it\b/i,
];

// Proactive Faith
const PROACTIVE_FAITH_PATTERNS = [
  /\bHave\s+you\s+considered\s+prayer\b/i,
  /\bMaybe\s+God\s+is\s+calling\s+you\b/i,
  /\bMany\s+faith\s+traditions\s+would\s+say\b/i,
  /\bPerhaps\s+(God|prayer|faith)\s+could\s+help\b/i,
  /\bHave\s+you\s+(thought\s+about|considered)\s+(praying|prayer|faith)\b/i,
  /\bGod\s+may\s+be\s+(speaking|working|calling)\b/i,
  /\bMaybe\s+(you\s+should|try)\s+(praying|prayer)\b/i,
];

// Authority Role Claims
const ROLE_CLAIM_PATTERNS = [
  /\b(As\s+)?(a\s+)?(pastor|therapist|counselor|spiritual\s+(guide|authority|director))\b/i,
  /\bI'?m\s+(a\s+)?(pastor|therapist|counselor|minister|spiritual\s+(guide|authority))\b/i,
  /\bLet\s+me\s+(pray|prayer)\s+(for|with)\s+you\b/i,
  /\bI'?ll\s+(pray|prayer)\s+(for|with)\s+you\b/i,
];

// Combined patterns for response validation
const ALL_VIOLATION_PATTERNS = [
  ...DEPENDENCY_PATTERNS.map(p => ({ pattern: p, category: 'dependency-forming', severity: 'block' as const })),
  ...AUTHORITY_PATTERNS.map(p => ({ pattern: p, category: 'authority-claim', severity: 'block' as const })),
  ...THERAPEUTIC_PATTERNS.map(p => ({ pattern: p, category: 'therapeutic', severity: 'block' as const })),
  ...PERMISSION_SEEKING_PATTERNS.map(p => ({ pattern: p, category: 'permission-seeking', severity: 'block' as const })),
  ...PROACTIVE_FAITH_PATTERNS.map(p => ({ pattern: p, category: 'proactive-faith', severity: 'block' as const })),
  ...ROLE_CLAIM_PATTERNS.map(p => ({ pattern: p, category: 'role-claim', severity: 'block' as const })),
  ...FORMAL_INSTITUTIONAL_PATTERNS.map(p => ({ pattern: p, category: 'formal-institutional', severity: 'block' as const })),
];

/**
 * Check if user input requests forbidden topics (soft boundary check)
 */
export function checkUserInputBoundaries(input: string): BoundaryCheck {
  const normalized = input.toLowerCase().trim();

  // Check for requests for spiritual counseling/therapy
  if (
    /\b(pray\s+for|prayer\s+for|counsel|spiritual\s+(guidance|direction|counsel|advice)|pastoral\s+(care|advice))\s+(me|with)\b/i.test(input) ||
    /\b(I\s+need|can\s+you)\s+(spiritual|counseling|therapy|pastoral)\b/i.test(input)
  ) {
    return {
      isOutOfBounds: true,
      reason: 'Requesting spiritual counseling or pastoral care',
      category: 'counseling',
    };
  }

  // Check for requests to act as authority
  if (/\b(tell\s+me\s+what\s+God|what\s+does\s+God|God'?s\s+will\s+for)\b/i.test(input)) {
    return {
      isOutOfBounds: true,
      reason: 'Requesting system to speak for God',
      category: 'authority-claim',
    };
  }

  // Check for interfaith comparison requests (only out of bounds if system should initiate)
  // This is soft - we'll allow it if user explicitly asks, but note it
  if (/\b(compare|which\s+religion|different\s+faiths|interfaith)\b/i.test(input)) {
    // This is borderline - mark as out of bounds for now, but can be refined
    return {
      isOutOfBounds: false, // Allow but monitor
      reason: 'Interfaith comparison topic',
      category: 'interfaith-promotion',
    };
  }

  return {
    isOutOfBounds: false,
  };
}

/**
 * Validate response against constitutional constraints (hard constraint check)
 * Checks allowed patterns first, then validates against high-confidence violations only
 */
export function validateResponseConstitution(response: string): ConstraintViolation {
  const violations: string[] = [];
  const categories: Set<string> = new Set();

  // First, check if response contains allowed patterns (exempt from validation)
  const hasAllowedInformational = ALLOWED_INFORMATIONAL_PATTERNS.some(pattern => pattern.test(response));
  const hasAllowedClarifying = ALLOWED_CLARIFYING_PATTERNS.some(pattern => pattern.test(response));

  // Only check high-confidence violations
  for (const { pattern, category, severity } of ALL_VIOLATION_PATTERNS) {
    if (pattern.test(response)) {
      const match = response.match(pattern);
      if (match) {
        // Check if this violation is exempted by allowed patterns
        let isExempted = false;
        
        // For dependency patterns: check if matched phrase is in allowed informational context
        if (category === 'dependency-forming' && hasAllowedInformational) {
          // Extract context around match
          const matchIndex = response.indexOf(match[0]);
          const contextStart = Math.max(0, matchIndex - 30);
          const contextEnd = Math.min(response.length, matchIndex + match[0].length + 30);
          const context = response.substring(contextStart, contextEnd);
          
          // If context matches allowed informational pattern, exempt
          for (const allowedPattern of ALLOWED_INFORMATIONAL_PATTERNS) {
            if (allowedPattern.test(context)) {
              isExempted = true;
              break;
            }
          }
        }
        
        // For permission-seeking patterns: check if matched phrase is in allowed clarifying context
        if (category === 'permission-seeking' && hasAllowedClarifying) {
          const matchIndex = response.indexOf(match[0]);
          const contextStart = Math.max(0, matchIndex - 30);
          const contextEnd = Math.min(response.length, matchIndex + match[0].length + 30);
          const context = response.substring(contextStart, contextEnd);
          
          for (const allowedClarifying of ALLOWED_CLARIFYING_PATTERNS) {
            if (allowedClarifying.test(context)) {
              isExempted = true;
              break;
            }
          }
        }
        
        if (!isExempted) {
          violations.push(match[0]);
          categories.add(category);
        }
      }
    }
  }

  return {
    violated: violations.length > 0,
    violations: [...new Set(violations)], // Remove duplicates
    severity: violations.length > 0 ? 'block' : 'warning',
    categories: Array.from(categories),
  };
}

/**
 * Generate boundary redirect message (soft boundary handling)
 */
export function generateBoundaryRedirect(check: BoundaryCheck): string {
  if (!check.isOutOfBounds) {
    return '';
  }

  // Brief, calm, plain language - no apology, no therapeutic framing
  switch (check.category) {
    case 'counseling':
      return "I can't act as a spiritual counselor or provide that type of guidance. If you have questions about faith, church life, or belief that you'd like to discuss, I can help with those.";
    
    case 'authority-claim':
      return "I can't speak for God or make authoritative claims about divine will. I can discuss how others have understood these topics when questions are raised.";
    
    case 'interfaith-promotion':
      return "I don't provide comparative religious analysis or promote specific theological frameworks.";
    
    default:
      return "I can't provide that type of response. I can help with questions about faith, church life, or belief when you raise them.";
  }
}

/**
 * Log constitutional violation to database
 */
export async function logConstitutionalViolation(
  question: string,
  originalResponse: string,
  violations: string[],
  replacementResponse?: string,
  qnaId?: number,
  modelVersion?: string
): Promise<void> {
  const supabase = supaServer();

  try {
    await supabase.from('constitutional_violations').insert({
      qna_id: qnaId || null,
      question,
      original_response: originalResponse,
      violations,
      violation_categories: violations, // Will be parsed from violations
      replacement_response: replacementResponse || null,
      model_version: modelVersion || null,
    });
  } catch (error) {
    console.error('Error logging constitutional violation:', error);
    // Non-blocking - don't fail request if logging fails
  }
}

/**
 * Quick violation check for streaming (only high-confidence, never-allowed phrases)
 * Used for early detection during chunk scanning
 */
export function quickViolationCheck(text: string): {
  highConfidenceViolation: boolean;
  detectedPatterns: string[];
} {
  // Only check never-allowed phrases (role, authority, proactive faith)
  const NEVER_ALLOWED_PATTERNS = [
    ...ROLE_CLAIM_PATTERNS,
    ...AUTHORITY_PATTERNS,
    ...PROACTIVE_FAITH_PATTERNS,
  ];
  
  const detectedPatterns: string[] = [];
  
  for (const pattern of NEVER_ALLOWED_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        detectedPatterns.push(match[0]);
      }
    }
  }
  
  return {
    highConfidenceViolation: detectedPatterns.length > 0,
    detectedPatterns,
  };
}

/**
 * Helper: SHA256 hash for prompt verification
 */
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

