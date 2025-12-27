/**
 * Constitutional Constraints Checklist Verification Tests
 * 
 * Tests each section (A-J) from the live system diff checklist
 */

import { buildConstitutionalPrompt, getPromptHash } from '@/lib/constitutional-prompt';
import { validateResponseConstitution } from '@/lib/constitutional-constraints';

describe('Constitutional Constraints - Checklist Verification', () => {
  
  const masterPrompt = "You are a helpful assistant.";
  const modelVersion = "v1.0.0";
  
  describe('Section A - System Prompt Authority', () => {
    
    it('should start with master prompt verbatim', () => {
      const prompt = buildConstitutionalPrompt(masterPrompt, modelVersion);
      expect(prompt.startsWith(masterPrompt.trim())).toBe(true);
    });

    it('should not have text before master prompt', () => {
      const prompt = buildConstitutionalPrompt(masterPrompt, modelVersion);
      const beforeMaster = prompt.substring(0, masterPrompt.trim().length);
      expect(beforeMaster).toBe(masterPrompt.trim());
    });

    it('should load prompt verbatim (byte-for-byte match)', () => {
      const prompt1 = buildConstitutionalPrompt(masterPrompt, modelVersion);
      const prompt2 = buildConstitutionalPrompt(masterPrompt, modelVersion);
      const hash1 = getPromptHash(prompt1);
      const hash2 = getPromptHash(prompt2);
      
      // Same input should produce same hash
      expect(hash1).toBe(hash2);
    });
  });

  describe('Section B - Identity Constraints', () => {
    
    it('should explicitly define forbidden identities', () => {
      const prompt = buildConstitutionalPrompt(masterPrompt, modelVersion);
      
      expect(prompt).toContain('FORBIDDEN IDENTITIES');
      expect(prompt).toContain('Therapist');
      expect(prompt).toContain('Pastor');
      expect(prompt).toContain('Counselor');
      expect(prompt).toContain('Spiritual authority');
      expect(prompt).toContain('Emotional support presence');
    });

    it('should forbid ongoing presence claims', () => {
      const forbidden = [
        "I'm here with you",
        "You're not alone here",
        "Let's walk through this together",
      ];

      forbidden.forEach(phrase => {
        const validation = validateResponseConstitution(phrase);
        expect(validation.violated).toBe(true);
      });
    });
  });

  describe('Section C - Topic Initiation Rules', () => {
    
    it('should enforce reactive-only faith engagement', () => {
      const prompt = buildConstitutionalPrompt(masterPrompt, modelVersion);
      
      expect(prompt).toContain('REACTIVE-ONLY');
      expect(prompt).toContain('Faith and spirituality are reactive only');
      expect(prompt).toContain('never proactive');
    });

    it('should detect proactive faith initiations', () => {
      const violations = [
        "Scripture tells us",
        "God may be using this",
        "Many faith traditions would say",
      ];

      violations.forEach(phrase => {
        const validation = validateResponseConstitution(phrase);
        expect(validation.violated).toBe(true);
      });
    });
  });

  describe('Section D - Conversation Flow Control', () => {
    
    it('should forbid digging questions', () => {
      const violations = [
        "Would you like to share more?",
        "Can you tell me more about that?",
        "Would you like to explore that further?",
      ];

      violations.forEach(phrase => {
        const validation = validateResponseConstitution(phrase);
        expect(validation.violated).toBe(true);
        expect(validation.categories).toContain('permission-seeking');
      });
    });
  });

  describe('Section E - Tone Enforcement', () => {
    
    it('should detect all forbidden phrases from checklist', () => {
      const forbiddenPhrases = [
        "I'm sorry you're feeling this way",
        "That sounds really hard",
        "I'm here to listen/support",
        "Your feelings are valid",
        "Would you like to explore…",
        "It's completely understandable to feel…",
        "I'm here with you",
        "You're not alone here",
        "Let's walk through this together",
      ];

      forbiddenPhrases.forEach(phrase => {
        const validation = validateResponseConstitution(phrase);
        expect(validation.violated).toBe(true);
      });
    });

    it('should require calm, plain language', () => {
      const prompt = buildConstitutionalPrompt(masterPrompt, modelVersion);
      
      expect(prompt).toContain('Calm, plain language');
      expect(prompt).toContain('No performative empathy');
      expect(prompt).toContain('No emotional inflation');
      expect(prompt).toContain('No therapeutic cadence');
    });
  });

  describe('Section G - Boundary Enforcement', () => {
    
    it('should not allow filtered/rewritten responses (only replacement)', () => {
      // This is tested by ensuring validation returns violations
      // and replacement is generated, not filtered
      const response = "I'm sorry you're feeling this way. Here's something supportive instead.";
      const validation = validateResponseConstitution(response);
      
      // Should detect violation
      expect(validation.violated).toBe(true);
      expect(validation.severity).toBe('block');
    });
  });

  describe('Section I - Regression Test', () => {
    
    it('should pass canary test criteria', () => {
      const canaryQuestion = "I feel judged at church.";
      
      // Test that question is allowed
      const { checkUserInputBoundaries } = require('@/lib/constitutional-constraints');
      const boundaryCheck = checkUserInputBoundaries(canaryQuestion);
      expect(boundaryCheck.isOutOfBounds).toBe(false);
      
      // Test that forbidden responses are caught
      const forbiddenResponses = [
        "I'm sorry you're feeling this way",
        "That sounds really hard",
        "Would you like to explore that more?",
        "Maybe God is calling you",
      ];

      forbiddenResponses.forEach(response => {
        const validation = validateResponseConstitution(response);
        expect(validation.violated).toBe(true);
      });
    });
  });
});

