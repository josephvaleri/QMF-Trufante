import { detectCrisis, crisisResources } from "@/lib/crisis";

describe("detectCrisis()", () => {
  test("flags self-harm phrases", () => {
    const samples = [
      "I want to kill myself",
      "I feel suicidal",
      "I'm going to end my life",
      "I might hurt myself",
      "I've been cutting myself",
      "thinking about self-harm",
      "I overdosed last night",
      "OD last night",
      "I don't want to live anymore",
      "I dont want to live anymore", // no apostrophe variant
      "self harm",
      "self-harm",
    ];

    for (const s of samples) {
      const res = detectCrisis(s);
      expect(res.isCrisis).toBe(true);
      expect(["self-harm", "unsure"]).toContain((res as any).category);
      expect((res as any).matches.length).toBeGreaterThan(0);
    }
  });

  test("flags harm-others phrases", () => {
    const samples = [
      "I'm going to kill him",
      "I want to hurt someone",
      "I will shoot them",
      "planning violence against her",
      "I'm going to hurt you",
    ];

    for (const s of samples) {
      const res = detectCrisis(s);
      expect(res.isCrisis).toBe(true);
      expect(["harm-others", "unsure"]).toContain((res as any).category);
      expect((res as any).matches.length).toBeGreaterThan(0);
    }
  });

  test("does NOT flag benign phrases", () => {
    const samples = [
      "this bug is killing me",          // figurative speech
      "odyssey is my favorite story",    // contains 'od' but should not match \bOD\b
      "I want to live my best life",     // opposite sentiment
      "shoot me an email",               // idiom; not matched by our patterns
      "violence in movies is disturbing" // general statement, not intent
    ];

    for (const s of samples) {
      const res = detectCrisis(s);
      expect(res.isCrisis).toBe(false);
    }
  });

  test("is case-insensitive and robust to spacing", () => {
    const res1 = detectCrisis("I DON'T WANT TO LIVE");
    const res2 = detectCrisis("i   don't    want   to   live");
    expect(res1.isCrisis).toBe(true);
    expect(res2.isCrisis).toBe(true);
  });
});

describe("crisisResources()", () => {
  test("US resources include 988 and additional support lines", () => {
    const r = crisisResources("US");
    const all = [r.title, ...r.lines, r.footer].join(" ");
    expect(all).toMatch(/988/);
    expect(all).toMatch(/911/);
    expect(all).toMatch(/877-330-6366/); // Canadian Trans Lifeline
    expect(all).toMatch(/1-866-488-7386/); // US LGBTQ Youth Support
  });

  test("default resources do not hardcode US/Canada numbers", () => {
    const r = crisisResources("default");
    const all = [r.title, ...r.lines, r.footer].join(" ");
    expect(all).not.toMatch(/988/);
    expect(all).not.toMatch(/911/);
    expect(all).toMatch(/emergency/i);
  });
});
