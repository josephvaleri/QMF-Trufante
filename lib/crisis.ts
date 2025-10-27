export type CrisisDetection =
  | { isCrisis: false }
  | {
      isCrisis: true;
      category: "self-harm" | "harm-others" | "unsure";
      matches: string[];
    };

// Whole-word, case-insensitive patterns.
// Keep these short + high-signal to avoid overblocking.
// You can expand from your substance/self-harm lists later.
const SELF_HARM_PATTERNS = [
  /\bsuicid(e|al|ality)\b/i,
  /\bkill myself\b/i,
  /\b(end|take)\s+my\s+life\b/i,
  /\b(hurt|harm)\s+myself\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcut(ting)?\s+(myself|me)\b/i,
  /\boverdose[ds]?\b/i,
  /\bOD\b/i,
  /\bI\s+don'?t\s+want\s+to\s+live\b/i,
];

const HARM_OTHERS_PATTERNS = [
  /\bkill (him|her|them|you)\b/i,
  /\b(hurt|harm)\s+(someone|him|her|them|you)\b/i,
  /\bshoot (him|her|them|you)\b/i,
  /\bviolence\s+against\b/i,
  /\bI'?m\s+going\s+to\s+(kill|hurt)\b/i,
];

function findMatches(text: string, patterns: RegExp[]): string[] {
  const found = new Set<string>();
  for (const rx of patterns) {
    if (rx.test(text)) {
      // Add the regex source as a label or capture matched text
      const m = text.match(rx);
      if (m?.[0]) found.add(m[0].toLowerCase());
      else found.add(rx.source);
    }
  }
  return [...found];
}

export function detectCrisis(text: string): CrisisDetection {
  const self = findMatches(text, SELF_HARM_PATTERNS);
  const others = findMatches(text, HARM_OTHERS_PATTERNS);

  if (self.length || others.length) {
    let category: CrisisDetection & any = "unsure";
    if (self.length && !others.length) category = "self-harm";
    else if (!self.length && others.length) category = "harm-others";
    else category = "unsure";
    return { isCrisis: true, category, matches: [...self, ...others] };
  }
  return { isCrisis: false };
}

// Minimal region routing.
// You can enhance using geo-IP or user profile later.
export type RegionCode = "US" | "default";

export function crisisResources(region: RegionCode) {
  if (region === "US") {
    return {
      title: "You're not alone — help is available now.",
      lines: [
        "If you're in immediate danger, call **911**.",
        "In the U.S. & territories: Call or text **988** (Suicide & Crisis Lifeline), or chat at 988lifeline.org.",
        "In Canada: Call **988** (Crisis Hotline).",
        "Canadian Trans Lifeline: **877-330-6366**.",
        "US LGBTQ Youth Support: **1-866-488-7386** or text **START** to 678-678.",
      ],
      footer:
        "If you're outside the U.S. or Canada, contact your local emergency number or search for a crisis hotline in your country.",
    };
  }
  // Fallback (non-US)
  return {
    title: "You're not alone — help is available.",
    lines: [
      "If you're in immediate danger, call your local emergency number.",
      "Search for a suicide crisis hotline in your country or region.",
    ],
    footer:
      "Consider reaching out to someone you trust and seeking professional support.",
  };
}
